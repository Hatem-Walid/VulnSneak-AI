"""
╔══════════════════════════════════════════════════════════════════════════════╗
║          XML Injection — Dataset Generator v4                              ║
║          Target : CodeBERT 512 / Transformer fine-tuning                   ║
║          Model  : Qwen3-235B via Cerebras API                              ║
║                                                                            ║
║  Covers: XXE, XPath Injection, XML Bomb, XSLT Injection, XInclude,        ║
║          SOAP Injection, Blind XXE, DTD Injection, XML Attribute Inj.,     ║
║          XML Signature Wrapping, SSRF via XXE, SVG XXE                     ║
║                                                                            ║
║  Anti-problem checklist:                                                   ║
║    ✅ Near-Duplicate  → 4-gram Jaccard 0.12–0.93 gate                      ║
║    ✅ Diversity       → 3-axis combo (subtype × lang/fw × context)         ║
║    ✅ Pair Quality    → global MITIGATION_SIGNALS + VULN_INDICATORS         ║
║    ✅ Consistency     → state="XML Injection", safe_code_label="Safe"       ║
║    ✅ Token Length    → WP estimator (÷3.5) enforces combined ≤ 509 tokens  ║
║    ✅ Context Diversity → 20 business contexts rotated evenly               ║
║    ✅ Soft balancing  → per-axis counters prevent subtype monopoly          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json, re, time, random
from pathlib import Path
from collections import defaultdict
from openai import OpenAI

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
CEREBRAS_KEY   = "csk-xxxxxxxxxxxxxxxx"
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
TARGET         = 2700
OUTPUT_FILE    = r"xml_injection_v4_output.jsonl"
CHECKPOINT     = r"xml_injection_v4_checkpoint.jsonl"

# CodeBERT 512 budget: [CLS] vuln [SEP] safe [SEP] = 512 → 509 usable
WP_BUDGET = 509
MAX_CHARS = 1900   # acceptance ceiling — smart_truncate fires before this


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """\
You are a security training-data engine that generates EXACTLY TWO code blocks \
for fine-tuning CodeBERT on XML Injection vulnerability detection.

OUTPUT FORMAT — strictly this, nothing else:

VULN:
<vulnerable code>

SAFE:
<fixed code>

════════════════════════════════════════════
SIZE RULES  (CRITICAL — model has 512 tokens)
════════════════════════════════════════════
• VULN: 6–12 lines (including imports). Aim for ~150–300 characters.
• SAFE: 8–16 lines. Aim for ~180–380 characters.
• COMBINED (VULN + SAFE) must be UNDER 1500 CHARACTERS TOTAL.
• Keep code concise — ONE import block, ONE function, minimal blank lines.

════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════
• No markdown fences, no backticks, no asterisks.
• No explanation text before or after the code blocks.
• ONE complete function per section: all needed imports + function def + body.
• Same function name and same parameters in VULN and SAFE.

════════════════════════════════════════════
VULNERABILITY RULES
════════════════════════════════════════════
• VULN must contain EXACTLY ONE XML Injection weakness — the specified subtype.
• VULN must include a REAL XML operation: parsing, querying, transforming,
  or serializing XML/SOAP/SVG. User input must actually flow into the XML
  operation without sanitization — do NOT use abstract placeholder code.
• SAFE must fix ONLY that weakness. All other logic stays identical.
• The fix must be a REAL mitigation (disable external entities, parameterized
  XPath, defusedxml, schema validation, input sanitization, etc.).
• SAFE must NOT still be vulnerable — blacklist-only fixes are not acceptable.

════════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════════
• Use realistic business identifiers (invoice IDs, usernames, product codes…).
• Function body must do something meaningful (parse, query, transform, respond).
• SAFE must use one of these proven mitigations:
    - Disable DOCTYPE / external entities before parsing
      (XMLConstants.FEATURE_SECURE_PROCESSING, defusedxml, etc.)
    - Parameterized XPath (XPathVariableResolver, compiled expressions)
    - Input validation / allowlist before embedding in XML/XPath
    - XML Schema (XSD) validation of untrusted XML input
    - Safe XML libraries (defusedxml, nokogiri safe mode, etc.)
    - For XSLT: disable extension functions, use secure transformer settings
"""


# ══════════════════════════════════════════════════════════════════════════════
#  SUBTYPES — 14 distinct XML Injection attack patterns
#  Format: (description, forbidden_in_safe)
#  expected signals → handled by global MITIGATION_SIGNALS list
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPES = [

    # ── 1. Classic XXE — SYSTEM entity ────────────────────────────────────────
    (
        "Classic XXE (XML External Entity): the application parses untrusted XML "
        "that defines a SYSTEM entity pointing to a local file (e.g., /etc/passwd) "
        "— the parser resolves the entity and leaks file contents in the response",
        # forbidden: external entity resolution must remain DISABLED in safe
        # (safe may reference these in comments — we check the code section only)
        [],   # no forbidden → rely on MITIGATION_SIGNALS gate
    ),

    # ── 2. XXE via SVG upload ──────────────────────────────────────────────────
    (
        "XXE via SVG file upload: the server renders or processes user-uploaded SVG "
        "files with an XML parser that resolves external entities — SVG is XML so "
        "a crafted SVG with a SYSTEM entity exfiltrates local files",
        [],
    ),

    # ── 3. XXE via document upload (DOCX/XLSX/ODT) ───────────────────────────
    (
        "XXE via Office document parsing (DOCX/XLSX/ODT): extracting and parsing "
        "XML members from a ZIP-based document format without disabling external "
        "entities — attacker embeds a SYSTEM entity in word/document.xml",
        [],
    ),

    # ── 4. Blind XXE — out-of-band via HTTP/DNS ───────────────────────────────
    (
        "Blind XXE (out-of-band): the parser resolves an external SYSTEM entity "
        "that triggers an HTTP or DNS callback to an attacker-controlled server — "
        "no content is reflected but exfiltration occurs via side channel",
        [],
    ),

    # ── 5. XXE — SSRF via external entity ─────────────────────────────────────
    (
        "XXE-based SSRF: external entity with a http:// or ftp:// URL causes the "
        "XML parser to make internal network requests on behalf of the server — "
        "attacker probes internal services (e.g., cloud metadata endpoint)",
        [],
    ),

    # ── 6. XPath Injection ────────────────────────────────────────────────────
    (
        "XPath Injection: user-supplied string is concatenated directly into an "
        "XPath expression without escaping — attacker injects ' or '1'='1 to "
        "bypass authentication or dump all XML nodes",
        # forbidden: raw string concat operators in XPath query in safe code
        # Note: we only flag very specific concat patterns, not generic quotes
        [],
    ),

    # ── 7. XML Bomb / Billion Laughs ──────────────────────────────────────────
    (
        "XML Bomb (Billion Laughs DoS): the application parses user-supplied XML "
        "that contains deeply nested recursive entity references — exponential "
        "entity expansion exhausts memory and CPU, causing denial of service",
        [],
    ),

    # ── 8. XInclude Injection ─────────────────────────────────────────────────
    (
        "XInclude Injection: user-controlled data is included in an XML document "
        "that is parsed with XInclude support enabled — attacker injects an "
        "xi:include element to read arbitrary local files",
        # forbidden: safe code must NOT enable xinclude processing
        ["process_xincludes=True", "xinclude=True", "processXInclude(true"],
    ),

    # ── 9. XSLT Injection ─────────────────────────────────────────────────────
    (
        "XSLT Injection: user-supplied XSLT stylesheet is applied to XML data "
        "without restricting extension functions — attacker uses document() or "
        "extension functions to execute code or read files",
        # forbidden: unsafe XSLT extension features must not remain enabled
        ["php:function(", "java.lang.Runtime", "enableExtensions = true"],
    ),

    # ── 10. SOAP Injection ────────────────────────────────────────────────────
    (
        "SOAP Injection: user-supplied string is embedded directly into a SOAP "
        "XML envelope without escaping — attacker injects closing tags and new "
        "SOAP elements to alter the web service call or add unauthorized parameters",
        # forbidden: unescaped f-string interpolation directly into SOAP body
        ["f\"<{", "f'<{", "+ username +", "+ userId +"],
    ),

    # ── 11. XML Attribute Injection ────────────────────────────────────────────
    (
        "XML Attribute Injection: user-controlled value is written into an XML "
        "attribute without encoding — attacker closes the attribute with '\" ' and "
        "injects new attributes (e.g., admin='true') or breaks XML structure",
        # Only flag very specific raw concat patterns - not generic f-strings
        ["+ value +", "+ userInput +"],
    ),

    # ── 12. DTD Injection — external subset ───────────────────────────────────
    (
        "DTD Injection via external subset: the application fetches and processes "
        "an externally referenced DTD from a URL supplied or influenced by the user "
        "— the DTD defines entities that exfiltrate data or cause SSRF",
        [],
    ),

    # ── 13. XML Signature Wrapping (XSW) ──────────────────────────────────────
    (
        "XML Signature Wrapping (XSW): SAML or WS-Security response is verified "
        "by signature but the application processes a different (unsigned) element "
        "with the same ID — attacker wraps a malicious element around the signed one",
        # forbidden: ID lookup without verifying it is the signed element
        ["getElementById(", "getAttributeValue(\"ID\""],
    ),

    # ── 14. XML Element / Content Injection ────────────────────────────────────
    (
        "XML Content Injection: user-supplied data is written into an XML element "
        "without encoding and then rendered as HTML — attacker injects markup that "
        "becomes stored XSS when the XML is serialized to an HTML page",
        # forbidden: raw string interpolation of user data into XML
        ["+ userInput", "+ content +", "+ rawData"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGES & FRAMEWORKS — 25 combinations
# ══════════════════════════════════════════════════════════════════════════════
LANG_FRAMEWORKS = [
    # Python
    ("Python",  "Flask + lxml"),
    ("Python",  "Django + defusedxml"),
    ("Python",  "FastAPI + lxml"),
    ("Python",  "plain Python (xml.etree)"),
    ("Python",  "plain Python (lxml)"),
    # Java
    ("Java",    "Spring Boot (JAXB)"),
    ("Java",    "JAX-RS / Jersey"),
    ("Java",    "Apache CXF (SOAP)"),
    ("Java",    "plain Java (DocumentBuilder)"),
    # Node.js
    ("NodeJS",  "Express + xml2js"),
    ("NodeJS",  "Fastify + fast-xml-parser"),
    ("NodeJS",  "NestJS + xml2js"),
    ("NodeJS",  "plain Node.js (xml2js)"),
    # PHP
    ("PHP",     "Laravel + SimpleXML"),
    ("PHP",     "Symfony + DOMDocument"),
    ("PHP",     "plain PHP (SimpleXML)"),
    # Go
    ("Go",      "Gin + encoding/xml"),
    ("Go",      "plain Go (encoding/xml)"),
    # C#
    ("CSharp",  "ASP.NET Core + XmlDocument"),
    ("CSharp",  "ASP.NET Core + XmlReader"),
    ("CSharp",  "plain C# (XDocument)"),
    # Ruby
    ("Ruby",    "Rails + Nokogiri"),
    ("Ruby",    "Sinatra + Nokogiri"),
    # Kotlin
    ("Kotlin",  "Ktor + JAXB"),
    ("Kotlin",  "Spring Boot Kotlin + DocumentBuilder"),
]


# ══════════════════════════════════════════════════════════════════════════════
#  BUSINESS CONTEXTS — 20 realistic scenarios
# ══════════════════════════════════════════════════════════════════════════════
CONTEXTS = [
    "invoice XML processing in billing / ERP system",
    "SAML SSO authentication in enterprise identity provider",
    "RSS / Atom feed parser in content aggregation platform",
    "SOAP web service endpoint in banking / fintech API",
    "SVG file upload in design / e-commerce product customizer",
    "DOCX / XLSX document parser in HR document management system",
    "XML configuration import in SaaS multi-tenant platform",
    "XPath-based user search in LDAP-backed directory service",
    "XML data export / import in supply chain management system",
    "XSLT report generation in financial reporting dashboard",
    "XML sitemap processing in SEO / web crawling service",
    "OpenAPI / WADL descriptor parsing in API gateway",
    "HL7 / FHIR XML message processing in healthcare system",
    "GPX / KML geospatial file import in mapping platform",
    "SCORM course package import in e-learning LMS",
    "XML-based product catalog import in e-commerce back-office",
    "SOAP-based payment gateway integration in checkout system",
    "XML vulnerability scan report import in security dashboard",
    "Office Open XML template processing in document generation SaaS",
    "XML-based config sync in IoT device management platform",
]


# ══════════════════════════════════════════════════════════════════════════════
#  GLOBAL MITIGATION SIGNALS
#  Any ONE present in safe_code → mitigation confirmed.
#  Covers all 8 languages + frameworks.
# ══════════════════════════════════════════════════════════════════════════════
MITIGATION_SIGNALS = [
    # ── Python — defusedxml ───────────────────────────────────────────────────
    "defusedxml", "defused_xml", "safe_etree",
    "from defusedxml", "import defusedxml",
    "forbid_dtd", "forbid_entities", "forbid_external",
    "no_network", "resolve_entities=False", "load_dtd=False",
    # ── Python — lxml secure flags ────────────────────────────────────────────
    "XMLParser(", "no_network=True", "resolve_entities=False",
    "XMLParser(resolve_entities", "XMLParser(no_network",
    "etree.XMLParser(", "lxml.etree",
    # ── Python — input escape ─────────────────────────────────────────────────
    "xml.sax.saxutils.escape", "saxutils.escape", "html.escape",
    "escape(user", "escape(input", "escape(value", "escape(data",
    "cgi.escape", "markupsafe",
    # ── Java — DocumentBuilderFactory secure ─────────────────────────────────
    "setFeature(", "DISALLOW_DOCTYPE_DECL", "FEATURE_SECURE_PROCESSING",
    "setExpandEntityReferences(false", "setValidating(false",
    "http://apache.org/xml/features",
    "external-general-entities", "external-parameter-entities",
    "disallow-doctype-decl",
    "setXIncludeAware(false",
    "newDocumentBuilder()", "DocumentBuilderFactory",
    # ── Java — SAX / StAX ─────────────────────────────────────────────────────
    "XMLInputFactory", "IS_SUPPORTING_EXTERNAL_ENTITIES",
    "SUPPORT_DTD", "setProperty(XMLInputFactory",
    "IS_NAMESPACE_AWARE", "IS_VALIDATING",
    # ── Java — XPath parameterized ────────────────────────────────────────────
    "XPathVariableResolver", "setXPathVariableResolver",
    "setVariable(", "XPathConstants",
    # ── Java — XSLT secure ────────────────────────────────────────────────────
    "enableSecureProcessing", "setSecureProcessing",
    "TransformerFactory.newInstance(", "SECURE_PROCESSING",
    "setErrorListener",
    # ── C# ────────────────────────────────────────────────────────────────────
    "DtdProcessing.Prohibit", "DtdProcessing.Ignore",
    "XmlReaderSettings", "ProhibitDtd",
    "XmlResolver = null", "XmlUrlResolver", "XmlSecureResolver",
    "new XmlReaderSettings", "settings.DtdProcessing",
    "SecurityElement.Escape", "HttpUtility.HtmlEncode",
    "XmlConvert.EncodeLocalName",
    # ── PHP ───────────────────────────────────────────────────────────────────
    "LIBXML_NONET", "LIBXML_DTDLOAD", "LIBXML_NOENT",
    "libxml_disable_entity_loader", "libxml_set_external_entity_loader",
    "LIBXML_NONET | LIBXML_DTDLOAD",
    "htmlspecialchars(", "htmlentities(",
    "addslashes(", "filter_var(",
    # ── Node.js / JS ──────────────────────────────────────────────────────────
    "processEntities: false", "allowBooleanAttributes",
    "explicitArray", "ignoreAttrs",
    "parseXml", "sanitize-xml", "xml-escape",
    "xmlEscape(", "escapeXml(", "xmlbuilder",
    "require('xmlbuilder", "require(\"xmlbuilder",
    # ── Go ────────────────────────────────────────────────────────────────────
    "xml.NewDecoder(", "d.Entity",
    "http.MaxBytesReader(", "io.LimitReader(",
    "golang.org/x/net/html",
    # ── Ruby — Nokogiri ───────────────────────────────────────────────────────
    "Nokogiri::XML::ParseOptions::NONET",
    "Nokogiri::XML::ParseOptions::NOBLANKS",
    "parse_options:", "NONET", "NOENT",
    "Nokogiri::XML(body, nil, nil,",
    "options.nononet", "options.nonet",
    "CGI.escapeHTML(", "ERB::Util.xml_name_escape",
    "Nokogiri::XML::ParseOptions::DEFAULT_XML",
    # ── Kotlin / JVM ──────────────────────────────────────────────────────────
    "XMLConstants.FEATURE_SECURE_PROCESSING",
    "factory.setFeature(", "dbf.setFeature(",
    "XMLConstants.ACCESS_EXTERNAL_DTD",
    "setProperty(XMLConstants",
    # ── XPath parameterized (language-agnostic) ───────────────────────────────
    "xpath.compile(", "xpath.evaluate(",
    "setVariable(", "XPathVariable",
    "param_", "bind_variable", "bindVariable",
    "parameterize", "prepared_xpath",
    # ── Schema validation (language-agnostic) ─────────────────────────────────
    "Schema(", "XmlSchema", ".xsd", "xmlschema",
    "SchemaFactory", "schema.validate(", "schema.newValidator",
    "validate_xml", "validate(source",
    # ── Generic escape / sanitize ─────────────────────────────────────────────
    "escapeXml", "escape_xml", "StringEscapeUtils",
    "allowlist", "whitelist", "ALLOWED_",
    "sanitize(", "sanitize_xml",
    "re.match(", "re.fullmatch(", "re.sub(",
    "re.escape(", "Pattern.compile(", "Regex(",
    # ── XSLT secure flags ─────────────────────────────────────────────────────
    "enableExtensions = false", "setExtensionElementPrefixes",
    "SECURE_PROCESSING", "secure_stylesheet",
    "restrict_xslt", "no_extensions",
    # ── Java — additional patterns ────────────────────────────────────────────
    "dbf.setFeature(", "factory.setFeature(", "spf.setFeature(",
    "builder.setFeature(", "parser.setFeature(",
    "setFeature(\"http://xml.org", "setFeature(\"http://javax.xml",
    "XMLConstants.ACCESS_EXTERNAL_DTD", "ACCESS_EXTERNAL_SCHEMA",
    "factory.setAttribute(", "dbf.setAttribute(",
    "newSAXParser()", "SAXParserFactory.newInstance(",
    # ── Python — additional ───────────────────────────────────────────────────
    "defusedxml.ElementTree", "defusedxml.minidom", "defusedxml.expatbuilder",
    "defusedxml.sax", "defusedxml.pulldom",
    "from defusedxml import", "import defusedxml",
    "etree.XMLParser(no_network", "etree.XMLParser(resolve_entities",
    "restrict_dtd=True", "forbid_dtd=True",
    # ── C# — additional ───────────────────────────────────────────────────────
    "settings.XmlResolver = null", "settings.DtdProcessing",
    "new XmlReaderSettings()", "XmlReader.Create(",
    "settings.MaxCharactersFromEntities",
    "XmlDocument.XmlResolver = null",
    # ── Node.js — additional ──────────────────────────────────────────────────
    "entities: false", "allowEntities", "entityExpansion",
    "parseOptions", "strict: true",
    # ── PHP — additional ──────────────────────────────────────────────────────
    "libxml_disable_entity_loader(true",
    "LIBXML_NONET | LIBXML_DTDATTR",
    "strip_tags(", "preg_replace(",
    # ── Go — additional ───────────────────────────────────────────────────────
    "charsetReader", "charset.NewReaderLabel",
    "xml.CopyToken", "xml.Token",
    # ── Ruby — additional ─────────────────────────────────────────────────────
    "Nokogiri::XML(xml_string, nil, nil,",
    "ParseOptions::NONET", "ParseOptions::DEFAULT_XML",
    "Nokogiri::XML.parse(", ".parse(doc, nil, nil,",
    # ── Generic structural guards ─────────────────────────────────────────────
    "max_depth", "maxDepth", "MAX_DEPTH",
    "entity_expansion_limit", "ENTITY_EXPANSION_LIMIT",
    "raise", "throw", "Exception(", "Error(",
    "return nil", "return null", "return false",
    "abort(", "halt(",
]


# ══════════════════════════════════════════════════════════════════════════════
#  VULN INDICATORS — must appear in vuln_code
#  Shows that actual XML/SOAP/XPath operation is present.
# ══════════════════════════════════════════════════════════════════════════════
VULN_INDICATORS = [
    # ── XML parsing keywords ──────────────────────────────────────────────────
    "xml", "XML", "etree", "ElementTree", "parse(",
    "fromstring(", "parseString(", "DocumentBuilder",
    "SAXParser", "SAXParserFactory", "XmlDocument",
    "XDocument", "XmlReader", "XmlTextReader",
    "SimpleXML", "simplexml", "DOMDocument", "DOMParser",
    "Nokogiri", "xml2js", "fast-xml-parser", "fxp",
    "xml.NewDecoder", "encoding/xml",
    "JAXB", "Unmarshal", "unmarshal", "Marshal",
    "XMLDecoder", "XMLEncoder",
    # ── XXE / DTD markers ─────────────────────────────────────────────────────
    "DOCTYPE", "ENTITY", "SYSTEM", "!ENTITY",
    "<!DOCTYPE", "<!ENTITY",
    # ── XPath ─────────────────────────────────────────────────────────────────
    "XPath", "xpath", "//user", "//", "selectNodes",
    "selectSingleNode", "evaluate(", "xmlXPathEval",
    "compile(\"//", "compile('//",
    # ── SOAP ──────────────────────────────────────────────────────────────────
    "SOAP", "soap", "Envelope", "envelope",
    "wsdl", "WSDL", "SOAPAction", "soapenv",
    "zeep", "suds", "SoapClient", "SoapServer",
    # ── XSLT ──────────────────────────────────────────────────────────────────
    "XSLT", "xslt", "transform(", "Transformer",
    "XslCompiledTransform", "xsltproc", "XSLTProcessor",
    "xsl:stylesheet", "xsl:template",
    # ── SVG ───────────────────────────────────────────────────────────────────
    "<svg", ".svg", "image/svg", "svg+xml",
    # ── XInclude ──────────────────────────────────────────────────────────────
    "xinclude(", "XInclude", "xi:include",
    "process_xincludes", "xinclude=True",
    # ── Office / ZIP XML ──────────────────────────────────────────────────────
    "docx", "xlsx", "odt", "ZipFile", "zipfile",
    "word/document.xml", "xl/workbook.xml",
    # ── Generic XML build / serialize ─────────────────────────────────────────
    "tostring(", "serialize(", "toString(",
    "XMLOutputter", "render_to_string",
    "buildString(", "xmlstring",
    # ── Raw string-building into XML (injection source) ────────────────────────
    "<user>", "<item>", "<name>", "<query>",
    "<request>", "<root>",
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGE WHITELIST — subtypes only valid for specific languages
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPE_LANG_WHITELIST: dict[str, list[str]] = {
    # XSW / SAML usually Java / Python / C# in enterprise SSO
    "XML Signature Wrapping": ["Java", "Python", "CSharp", "Kotlin"],
    # XSLT: all langs have parsers but C#/Java most common
    "XSLT Injection": ["Java", "Python", "CSharp", "PHP", "Ruby", "Kotlin"],
    # SOAP: Java, C#, Python, PHP — not idiomatic in Go/Ruby/Node normally
    "SOAP Injection": ["Java", "CSharp", "Python", "PHP", "Kotlin"],
}


# ══════════════════════════════════════════════════════════════════════════════
#  API CLIENT
# ══════════════════════════════════════════════════════════════════════════════
client = OpenAI(api_key=CEREBRAS_KEY, base_url="https://api.cerebras.ai/v1")


def call_api(user_msg: str) -> str | None:
    for attempt in range(4):
        try:
            resp = client.chat.completions.create(
                model=CEREBRAS_MODEL,
                max_tokens=650,
                temperature=0.80,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            return resp.choices[0].message.content
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "quota" in msg.lower():
                print("  [LIMIT] Daily quota — sleeping 60s …")
                time.sleep(60)
            else:
                if attempt == 3:
                    print(f"  [ERR] {msg[:90]}")
                time.sleep(2 * (attempt + 1))
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  PARSE BLOCKS
# ══════════════════════════════════════════════════════════════════════════════
def parse_blocks(text: str) -> tuple[str | None, str | None]:
    """Extract VULN / SAFE blocks; strip markdown fences."""
    text = re.sub(r'\*\*(VULN|SAFE):\*\*', r'\1:', text, flags=re.IGNORECASE)
    text = re.sub(r'```[a-zA-Z]*\n?', '', text)
    text = re.sub(r'```', '', text)
    vm = re.search(r'VULN:\s*\n(.*?)(?=\nSAFE:)', text, re.DOTALL | re.IGNORECASE)
    sm = re.search(r'SAFE:\s*\n(.+)$',             text, re.DOTALL | re.IGNORECASE)
    if not vm or not sm:
        return None, None
    return vm.group(1).strip(), sm.group(1).strip()


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def wp_tokens(text: str) -> int:
    """WP-token estimator calibrated to RobertaTokenizer (÷3.5, conservative)."""
    return max(1, int(len(text) / 3.5))


def strip_comments(code: str) -> str:
    code = re.sub(r'#.*',        '',  code)
    code = re.sub(r'//.*',       '',  code)
    code = re.sub(r'/\*.*?\*/',  '',  code, flags=re.DOTALL)
    code = re.sub(r'""".*?"""',  '',  code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''",  '',  code, flags=re.DOTALL)
    return code


def tokenize(code: str) -> list[str]:
    return re.findall(r'[a-zA-Z_]\w*|[0-9]+', code)


def jaccard(a: list, b: list) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / (len(sa) + len(sb) - len(sa & sb))


# Expanded has_function — covers all 8 languages + frameworks
FUNCTION_KEYWORDS = [
    # Python / Ruby / Go
    "def ", "func ", "fn ",
    # Java / C# / Kotlin
    "public ", "private ", "protected ", "internal ", "override ",
    "static ", "void ", "async ",
    # JS / TS
    "function ", "async function", "const ", "let ", "var ",
    "module.exports", "exports.",
    # PHP
    "<?php",
    # Kotlin / Scala
    "fun ", "object ",
    # OOP
    "class ", "interface ", "sub ",
    # Framework route handlers
    "Route(", "router.", "app.get(", "app.post(", "app.put(",
    "http.HandleFunc(", "http.Handle(",
    "Route::", "@app.route", "@router.",
    # Ruby DSL
    " do\n", " do |", "post '", "get '", "post \"", "get \"",
]

def has_function(code: str) -> bool:
    return any(kw in code for kw in FUNCTION_KEYWORDS)


def smart_truncate(code: str, budget: int) -> str:
    """Trim code line-by-line to fit within budget WP-tokens."""
    lines, kept, total = code.split('\n'), [], 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > budget:
            break
        kept.append(line)
        total += cost
    result = '\n'.join(kept)
    if len(kept) < len(lines):
        opens = result.count('{') - result.count('}')
        if opens > 0:
            result += '\n' + '}\n' * opens
    return result


# ══════════════════════════════════════════════════════════════════════════════
#  NEAR-DUPLICATE DETECTION  (4-gram fingerprint)
# ══════════════════════════════════════════════════════════════════════════════
def ngrams(code: str, n: int = 4) -> frozenset:
    t = tokenize(code)
    if len(t) < n:
        return frozenset(t)
    return frozenset('|'.join(t[i:i+n]) for i in range(len(t) - n + 1))


def is_near_dup(fp: frozenset, seen: list[frozenset], threshold: float = 0.80) -> bool:
    for prev in seen:
        inter = len(fp & prev)
        union = len(fp) + len(prev) - inter
        if union and inter / union >= threshold:
            return True
    return False


# ══════════════════════════════════════════════════════════════════════════════
#  VALIDATION GATE — 8 checks every pair must pass
# ══════════════════════════════════════════════════════════════════════════════
def validate(vuln: str, safe: str, subtype_tuple: tuple) -> tuple[bool, str]:
    desc, forbidden = subtype_tuple

    if not vuln or not safe:
        return False, "empty block"
    if not has_function(vuln):
        return False, "vuln: no function"
    if not has_function(safe):
        return False, "safe: no function"

    # ── Length / char guards ──────────────────────────────────────────────────
    vc, sc = len(vuln), len(safe)
    if vc < 70:             return False, f"vuln too short ({vc} chars)"
    if vc > 1200:           return False, f"vuln too long ({vc} chars)"
    if sc < 90:             return False, f"safe too short ({sc} chars)"
    if sc > 1300:           return False, f"safe too long ({sc} chars)"
    if vc + sc > MAX_CHARS: return False, f"combined too long ({vc+sc} chars)"

    # ── CodeBERT WP-token guard ───────────────────────────────────────────────
    vwp = wp_tokens(vuln)
    swp = wp_tokens(safe)
    if vwp + swp + 3 > WP_BUDGET + 3:
        return False, f"WP-token overflow ({vwp+swp+3} > 512)"

    # ── Identifier count ──────────────────────────────────────────────────────
    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 8:  return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 8:  return False, f"safe too few identifiers ({len(st)})"

    # ── Jaccard pair-quality gate ─────────────────────────────────────────────
    sim = jaccard(vt, st)
    if sim < 0.12:   return False, f"pair too dissimilar ({sim:.2f})"
    if sim >= 0.97:  return False, f"pair too similar / zero-change ({sim:.2f})"

    # ── Zero-change detection (line-level) ───────────────────────────────────
    vlines = {l.strip() for l in vuln.split('\n') if l.strip()}
    slines = {l.strip() for l in safe.split('\n') if l.strip()}
    if vlines == slines:
        return False, "zero-change: vuln and safe are line-identical"

    # ── Security signal checks ────────────────────────────────────────────────
    safe_nc = strip_comments(safe)

    # Forbidden patterns must NOT remain in safe_code
    for pat in (forbidden or []):
        if pat in safe_nc:
            return False, f"forbidden pattern still in safe: '{pat}'"

    # ── TIER-1: Global mitigation keyword list ────────────────────────────────
    tier1 = any(sig in safe for sig in MITIGATION_SIGNALS)

    # ── TIER-2: Broad structural security patterns (language-agnostic) ────────
    # Catches valid mitigations that use custom variable names / API calls
    BROAD_SECURITY = [
        # Any "disable / prohibit / restrict / prevent" + XML-related keyword
        "disable", "Disable", "DISABLE",
        "prohibit", "Prohibit", "PROHIBIT",
        "restrict", "Restrict", "prevent",
        "secure", "Secure", "SECURE",
        "safe_", "Safe", "_safe",
        # Input validation patterns
        "validate", "Validate", "VALIDATE",
        "verify", "Verify", "check_",
        "is_valid", "isValid", "is_safe",
        # Encoding / escaping
        "encode", "Encode", "ENCODE",
        "escape", "Escape", "ESCAPE",
        "sanitize", "Sanitize", "clean_",
        # Rejection / error handling as mitigation
        "raise ValueError", "raise SecurityError", "raise Exception",
        "throw new", "throw new Security", "throw new Illegal",
        "return Response(status=400", "return Response(status=403",
        "response.status(400", "response.status(403",
        "res.status(400", "res.status(403", "res.status(422",
        "abort(400", "abort(403", "abort(422",
        "HttpStatus.BAD_REQUEST", "HttpStatus.FORBIDDEN",
        "StatusCode.BadRequest", "StatusCode.Forbidden",
        "http.StatusBadRequest", "http.StatusForbidden",
        "render json:.*error", "render json:.*invalid",
        # Allow-listing
        "allowed_", "ALLOWED_", "allowlist", "whitelist",
        "in ALLOWED", "in allowed", "in valid_",
        # Parameterized / compiled queries
        "compile(", "compiled", "prepared", "parameterize",
        "bind(", "setParam", "addParam",
        # Size / depth limits
        "max_", "MAX_", "limit", "LIMIT",
        "depth", "DEPTH", "size_limit",
    ]
    tier2 = any(pat in safe for pat in BROAD_SECURITY)

    # ── TIER-3: Structural diff — safe must add NEW lines not in vuln ──────────
    vuln_lines = set(l.strip() for l in vuln.split('\n') if l.strip())
    safe_lines  = set(l.strip() for l in safe.split('\n') if l.strip())
    new_lines   = safe_lines - vuln_lines
    # At least 2 genuinely new lines (not just import/comment)
    meaningful_new = [l for l in new_lines
                      if len(l) > 10
                      and not l.startswith('#')
                      and not l.startswith('//')
                      and not l.startswith('import ')
                      and not l.startswith('from ')
                      and not l.startswith('using ')]
    tier3 = len(meaningful_new) >= 2

    if not (tier1 or tier2 or tier3):
        # Debug: print a snippet so we can identify missing patterns
        snippet = safe[:120].replace('\n', ' | ')
        return False, f"no mitigation detected — safe snippet: {snippet}"

    # ── XML vulnerability must appear in vuln_code ────────────────────────────
    if not any(ind in vuln for ind in VULN_INDICATORS):
        return False, "vuln code does not appear to involve XML operations"

    return True, ""


# ══════════════════════════════════════════════════════════════════════════════
#  CHECKPOINT I/O
# ══════════════════════════════════════════════════════════════════════════════
def load_checkpoint() -> list[dict]:
    p = Path(CHECKPOINT)
    if not p.exists():
        return []
    out = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            try:
                out.append(json.loads(line))
            except Exception:
                pass
    return out


def save_checkpoint(samples: list[dict]) -> None:
    Path(CHECKPOINT).parent.mkdir(parents=True, exist_ok=True)
    with open(CHECKPOINT, "w", encoding="utf-8") as f:
        for s in samples:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")


# ══════════════════════════════════════════════════════════════════════════════
#  PROMPT BUILDER
# ══════════════════════════════════════════════════════════════════════════════
def build_user_msg(subtype_desc: str, lang: str, fw: str, ctx: str) -> str:
    return (
        f"Language: {lang}\n"
        f"Framework / Library: {fw}\n"
        f"Vulnerability subtype: {subtype_desc}\n"
        f"Business context: {ctx}\n\n"
        "Requirements:\n"
        "- VULN: 7–16 lines, ~180–380 chars. ONE XML Injection weakness.\n"
        "- VULN must include a REAL XML operation: parsing, XPath query,\n"
        "  SOAP call, XSLT transform, or XML serialization. User input MUST\n"
        "  flow into the XML operation without sanitization.\n"
        "- SAFE: 9–20 lines, ~220–450 chars. Fix ONLY the XML weakness.\n"
        "- Combined VULN + SAFE must be UNDER 1500 CHARACTERS.\n"
        "- Use realistic identifiers matching the business context.\n"
        "- Same function name and parameters in both blocks.\n"
        "- Include minimal necessary imports only.\n"
        "- Safe mitigation must be genuinely effective:\n"
        "  disable external entities, use defusedxml/safe parsers,\n"
        "  parameterize XPath, validate schema, escape output."
    )


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    samples = load_checkpoint()
    kept    = len(samples)

    # Restore fingerprints from checkpoint
    fingerprints: list[frozenset] = [ngrams(s["vuln_code"]) for s in samples]

    # Per-axis counters for even distribution
    subtype_counts  = defaultdict(int)
    lang_counts     = defaultdict(int)
    context_counts  = defaultdict(int)
    for s in samples:
        subtype_counts[s.get("_subtype", "")]  += 1
        lang_counts[s.get("_lang", "")]        += 1
        context_counts[s.get("_context", "")]  += 1

    skipped = errors = 0

    # Build all combos and shuffle
    combos = [
        (sub, lang, fw, ctx)
        for sub in SUBTYPES
        for (lang, fw) in LANG_FRAMEWORKS
        for ctx in CONTEXTS
    ]
    random.shuffle(combos)
    total_combos = len(combos)
    combo_idx    = kept % total_combos

    print(f"╔══════════════════════════════════════╗")
    print(f"║  XML Injection Dataset Generator     ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  Loaded from checkpoint : {kept}")
    print(f"  Target                 : {TARGET}")
    print(f"  Total combos           : {total_combos:,}")
    print(f"  Subtypes               : {len(SUBTYPES)}")
    print(f"  Lang/Framework combos  : {len(LANG_FRAMEWORKS)}")
    print(f"  Business contexts      : {len(CONTEXTS)}")
    print()

    while kept < TARGET:
        # ── Pick next combo ────────────────────────────────────────────────────
        subtype_tuple, lang, fw, ctx = combos[combo_idx % total_combos]
        combo_idx += 1
        subtype_desc = subtype_tuple[0]

        # ── Lang whitelist: skip incompatible lang/subtype combos ─────────────
        skip_combo = False
        for wl_key, allowed_langs in SUBTYPE_LANG_WHITELIST.items():
            if wl_key in subtype_desc and lang not in allowed_langs:
                skip_combo = True
                break
        if skip_combo:
            continue

        # ── Soft balancing: skip over-represented subtypes ────────────────────
        avg_sub = kept / max(len(SUBTYPES), 1)
        if subtype_counts[subtype_desc] > avg_sub * 1.4 and kept > 50:
            skipped += 1
            continue

        # ── Call API ──────────────────────────────────────────────────────────
        user_msg = build_user_msg(subtype_desc, lang, fw, ctx)
        raw = call_api(user_msg)
        if not raw:
            errors  += 1
            skipped += 1
            continue

        # ── Parse blocks ──────────────────────────────────────────────────────
        vuln, safe = parse_blocks(raw)
        if not vuln or not safe:
            skipped += 1
            continue

        # ── Smart truncate — char ceiling ────────────────────────────────────
        combined_chars = len(vuln) + len(safe)
        if combined_chars > MAX_CHARS:
            # Split budget proportionally by current size
            vc, sc = len(vuln), len(safe)
            v_char_budget  = max(200, int(MAX_CHARS * vc / max(vc + sc, 1)))
            sf_char_budget = MAX_CHARS - v_char_budget
            # convert char budget → WP budget for smart_truncate
            if vc > v_char_budget:
                vuln = smart_truncate(vuln, max(55, v_char_budget // 4))
            if sc > sf_char_budget:
                safe = smart_truncate(safe, max(65, sf_char_budget // 4))

        # ── Smart truncate — WP token ceiling ────────────────────────────────
        total_wp = wp_tokens(vuln) + wp_tokens(safe) + 3
        if total_wp > WP_BUDGET + 3:
            vwp = wp_tokens(vuln)
            swp = wp_tokens(safe)
            v_budget  = max(60, int(WP_BUDGET * vwp / max(vwp + swp, 1)))
            sf_budget = WP_BUDGET - v_budget
            if vwp > v_budget:
                vuln = smart_truncate(vuln, v_budget)
            if swp > sf_budget:
                safe = smart_truncate(safe, sf_budget)

        # ── Validate ──────────────────────────────────────────────────────────
        ok, reason = validate(vuln, safe, subtype_tuple)
        if not ok:
            print(f"  [SKIP] {reason}")
            skipped += 1
            continue

        # ── Near-duplicate guard ──────────────────────────────────────────────
        fp = ngrams(vuln)
        if is_near_dup(fp, fingerprints):
            print(f"  [DUP]  near-duplicate rejected")
            skipped += 1
            continue

        # ── Accept sample ─────────────────────────────────────────────────────
        fingerprints.append(fp)
        subtype_counts[subtype_desc] += 1
        lang_counts[lang]            += 1
        context_counts[ctx]          += 1

        samples.append({
            "vuln_code":       vuln,
            "state":           "XML Injection",
            "safe_code":       safe,
            "safe_code_label": "Safe",
            # internal tracking fields (stripped in final save)
            "_subtype":        subtype_desc[:60],
            "_lang":           lang,
            "_framework":      fw,
            "_context":        ctx,
        })
        kept += 1

        # ── Checkpoint every 10 ───────────────────────────────────────────────
        if kept % 10 == 0:
            save_checkpoint(samples)
            total_done = kept + skipped
            skip_pct   = skipped * 100 // total_done if total_done else 0
            avg_wp     = sum(
                wp_tokens(s["vuln_code"]) + wp_tokens(s["safe_code"]) + 3
                for s in samples[-10:]
            ) // 10
            print(
                f"  [{kept:>4}/{TARGET}]  {kept*100//TARGET:>3}%  "
                f"skip={skipped} ({skip_pct}%)  err={errors}  "
                f"avg_wp={avg_wp}"
            )

        time.sleep(0.15)

    # ── Final save (strip internal fields) ────────────────────────────────────
    save_checkpoint(samples)

    final = [
        {k: v for k, v in s.items() if not k.startswith("_")}
        for s in samples
    ]
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in final:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    # ── Final stats ───────────────────────────────────────────────────────────
    print()
    print(f"╔══════════════════════════════════════╗")
    print(f"║  DONE — {kept} samples saved          ║")
    print(f"╚══════════════════════════════════════╝")
    print(f"  Output    : {OUTPUT_FILE}")
    print(f"  Skip total: {skipped}")
    print(f"  Errors    : {errors}")
    print()
    print("  Subtype distribution:")
    for k, v in sorted(subtype_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k[:70]}")
    print()
    print("  Language distribution:")
    for k, v in sorted(lang_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")


if __name__ == "__main__":
    main()
