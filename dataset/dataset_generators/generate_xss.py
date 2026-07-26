"""
╔══════════════════════════════════════════════════════════════════════════════╗
║       XSS — Dataset Generator v4                                           ║
║       Target : CodeBERT 512 / Transformer fine-tuning                      ║
║       Model  : Qwen3-235B via Cerebras API (4 keys — parallel)             ║
║       Samples: 1,500                                                       ║
║                                                                            ║
║  Covers 14 subtypes:                                                       ║
║    Reflected XSS, Stored XSS, DOM-based XSS, innerHTML injection,         ║
║    document.write injection, URL parameter reflection, JSON response       ║
║    XSS, Template literal injection, Event handler injection,               ║
║    SVG XSS, CSS injection, postMessage XSS, Angular template inj.,        ║
║    Server-Side Template XSS (SSTI→XSS)                                    ║
║                                                                            ║
║  Lessons from old XSS dataset review:                                     ║
║    ❌ Old: 893 exact dups, 1098 near-dups (30%), 400 wrong state          ║
║    ❌ Old: 640 vuln <70 chars (junk), label='safe' not 'Safe'             ║
║    ✅ New: 3-axis combo + output_context pool forces content diversity     ║
║    ✅ New: min 120 char vuln enforced in validate()                        ║
║    ✅ New: state="XSS", label="Safe" enforced                              ║
║    ✅ New: semantic XSS vuln check (innerHTML/echo/render without escape)  ║
║    ✅ New: 4-parallel keys, per-key rate-limit, thread-safe near-dup       ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import json, re, time, random, threading
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI

# ─────────────────────────────────────────────────────────────────────────────
#  CONFIG
# ─────────────────────────────────────────────────────────────────────────────
CEREBRAS_KEYS = [csk-xxxxxxxxxxxxxxxx]
CEREBRAS_MODEL = "qwen-3-235b-a22b-instruct-2507"
TARGET         = 1500
OUTPUT_FILE    = r"xss_v4_output.jsonl"
CHECKPOINT     = r"xss_v4_checkpoint.jsonl"

WP_BUDGET  = 509
MAX_CHARS  = 1900
BATCH_SIZE = 4


# ══════════════════════════════════════════════════════════════════════════════
#  OUTPUT CONTEXT POOL — 30 unique HTML/JS output contexts
#  Forces diversity so old dataset's repetition problem is avoided
# ══════════════════════════════════════════════════════════════════════════════
OUTPUT_CONTEXTS = [
    "a <div> tag body showing a user-submitted comment",
    "an <input> value attribute in a search form",
    "an <a href> attribute linking to a user-supplied URL",
    "a <script> block assigning a server variable to a JS var",
    "an HTML page title using the user's display name",
    "a JSON API response later parsed with innerHTML",
    "an error message rendered in a <p> tag",
    "a product description rendered in an e-commerce card",
    "a notification banner with a user-controlled message",
    "an SVG image with injected markup in description field",
    "a CSV export rendered as an HTML table",
    "a log entry displayed in an admin dashboard",
    "a chat message rendered in a messaging app",
    "a URL fragment (#) read with location.hash",
    "a search query reflected in 'You searched for: ...' text",
    "a username shown in a profile page header",
    "a file upload filename shown in a confirmation message",
    "a redirect URL taken from a query parameter",
    "an email template with user-supplied subject line",
    "a tooltip text built from a database field",
    "a <meta name='description'> tag using user content",
    "a modal dialog title from an API response",
    "a breadcrumb navigation with a user-controlled segment",
    "an event attribute (onclick) built from user data",
    "a CSS style attribute with user-controlled color value",
    "a postMessage payload rendered in an iframe",
    "an Angular / Vue template with unescaped binding",
    "a Jinja2 / Twig template with raw filter",
    "a React dangerouslySetInnerHTML with user content",
    "a WebSocket message rendered directly into DOM",
]


# ══════════════════════════════════════════════════════════════════════════════
#  SYSTEM PROMPT
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """\
You are a security training-data engine that generates EXACTLY TWO code blocks \
for fine-tuning CodeBERT on XSS (Cross-Site Scripting) vulnerability detection.

OUTPUT FORMAT — strictly this, nothing else:

VULN:
<vulnerable code>

SAFE:
<fixed code>

════════════════════════════════════════════
SIZE RULES  (CRITICAL — model has 512 tokens)
════════════════════════════════════════════
• VULN: 8–16 lines (including imports). Aim for ~200–420 characters.
• SAFE: 10–20 lines. Aim for ~230–490 characters.
• COMBINED (VULN + SAFE) must be UNDER 1700 CHARACTERS TOTAL.
• Shorten business logic if needed — never shorten the security fix.
• No docstrings. No multi-line comments.

════════════════════════════════════════════
CRITICAL DIFFERENCE REQUIREMENT
════════════════════════════════════════════
• The output/rendering line MUST look visibly different between VULN and SAFE.
• VULN renders user input DIRECTLY into HTML/JS without encoding.
• SAFE replaces the rendering with an escaped/encoded version.
• Do NOT just rename variables — the escaping call must appear in SAFE.

Examples:
  VULN: return f"<div>{comment}</div>"
  SAFE: return f"<div>{html.escape(comment)}</div>"

  VULN: res.send(`<p>${userInput}</p>`)
  SAFE: res.send(`<p>${escapeHtml(userInput)}</p>`)

  VULN: element.innerHTML = data
  SAFE: element.textContent = data

════════════════════════════════════════════
FORMAT RULES
════════════════════════════════════════════
• No markdown fences, no backticks, no asterisks.
• No explanation text before or after the code blocks.
• ONE complete function per section: imports + function def + body.
• Same function name and same parameters in VULN and SAFE.

════════════════════════════════════════════
VULNERABILITY RULES
════════════════════════════════════════════
• VULN must contain EXACTLY ONE XSS weakness — the specified subtype.
• VULN must include a REAL rendering of user input into HTML/JS output
  WITHOUT encoding — not abstract or placeholder code.
• The specific output context must match the one specified.
• SAFE must fix ONLY the XSS. All other logic stays identical.
• The fix must be a REAL mitigation — NOT just input length checks.

════════════════════════════════════════════
QUALITY RULES
════════════════════════════════════════════
• Use realistic variable names matching the business context.
• SAFE must use one of these proven XSS mitigations:
    - html.escape() / cgi.escape() / markupsafe.escape() — Python
    - htmlspecialchars() / htmlentities() — PHP
    - escapeHtml() / DOMPurify.sanitize() / textContent — JS/Node
    - HtmlEncoder.encode() / StringEscapeUtils.escapeHtml4() — Java
    - HtmlEncode() / AntiXssEncoder.HtmlEncode() — C#
    - h() / html_escape / ERB::Util.html_escape — Ruby
    - template auto-escaping (Jinja2, Twig, Thymeleaf, Razor)
    - Content-Security-Policy header (secondary mitigation)
    - element.textContent instead of innerHTML — DOM-based
    - JSON.stringify + sanitization for JSON context
"""


# ══════════════════════════════════════════════════════════════════════════════
#  SUBTYPES — 14 distinct XSS attack patterns
#  Format: (description, forbidden_in_safe)
# ══════════════════════════════════════════════════════════════════════════════
SUBTYPES = [

    # ── 1. Reflected XSS — server response ───────────────────────────────────
    (
        "Reflected XSS: user-supplied query parameter (search term, username, "
        "error message) is immediately reflected into the HTML response body "
        "without encoding — attacker crafts a URL with <script>alert(1)</script>",
        [],
    ),

    # ── 2. Stored / Persistent XSS ────────────────────────────────────────────
    (
        "Stored XSS: user-controlled data (comment, bio, message, review) is "
        "saved to the database and later rendered in HTML without encoding — "
        "the payload executes for every user who views the page",
        [],
    ),

    # ── 3. DOM-based XSS — innerHTML ──────────────────────────────────────────
    (
        "DOM-based XSS via innerHTML: client-side JavaScript reads attacker-"
        "controlled data (location.search, location.hash, postMessage, "
        "localStorage) and writes it to element.innerHTML without sanitization",
        # forbidden: innerHTML assignment with user data must be gone in safe
        ["innerHTML = user", "innerHTML = data", "innerHTML = input",
         "innerHTML = msg", "innerHTML = val", "innerHTML = content",
         "innerHTML = param", "innerHTML = hash", "innerHTML = query"],
    ),

    # ── 4. document.write injection ───────────────────────────────────────────
    (
        "XSS via document.write(): client-side code calls document.write() "
        "with unsanitized user-controlled data — attacker injects script tags "
        "or event handlers that execute immediately",
        # forbidden: document.write with user data in safe
        ["document.write(user", "document.write(data", "document.write(input",
         "document.write(param", "document.write(`"],
    ),

    # ── 5. URL parameter reflection ───────────────────────────────────────────
    (
        "URL parameter XSS: server-side code reads a URL query parameter and "
        "embeds it into the response without encoding — common in redirect pages, "
        "search results, and error pages that echo back the request parameters",
        [],
    ),

    # ── 6. JSON response XSS ──────────────────────────────────────────────────
    (
        "JSON response XSS: API endpoint returns user-controlled data in a JSON "
        "response with Content-Type: text/html instead of application/json — "
        "or the JSON is parsed and injected into innerHTML without sanitization",
        [],
    ),

    # ── 7. Template literal / string interpolation XSS ────────────────────────
    (
        "Template literal XSS: JavaScript template literal (backtick string) "
        "interpolates user-controlled data directly into an HTML string that is "
        "then set as innerHTML or returned as a response body",
        [],
    ),

    # ── 8. Event handler injection ────────────────────────────────────────────
    (
        "Event handler XSS: user-supplied data is embedded in an HTML event "
        "handler attribute (onclick, onmouseover, onerror) without encoding — "
        "attacker injects JavaScript that executes when the event fires",
        [],
    ),

    # ── 9. SVG / XML XSS ──────────────────────────────────────────────────────
    (
        "SVG XSS: user-controlled data is embedded in an SVG document or XML "
        "response without encoding — SVG supports <script> elements and event "
        "handlers, so injected markup executes in browser context",
        [],
    ),

    # ── 10. CSS injection → XSS ───────────────────────────────────────────────
    (
        "CSS injection leading to XSS: user-controlled value is embedded in a "
        "CSS style attribute or <style> block without validation — attacker "
        "injects expression() in IE or url('javascript:...') to execute scripts",
        [],
    ),

    # ── 11. postMessage XSS ───────────────────────────────────────────────────
    (
        "postMessage XSS: the application receives postMessage events and renders "
        "the message data into the DOM without origin validation or sanitization "
        "— attacker sends a malicious message from a cross-origin page",
        [],
    ),

    # ── 12. Angular / Vue template injection ──────────────────────────────────
    (
        "Client-side template injection (AngularJS / Vue): user-controlled string "
        "is rendered inside an ng-app or Vue template scope without sanitization "
        "— attacker uses {{constructor.constructor('alert(1)')()}} to escape sandbox",
        [],
    ),

    # ── 13. Server-side template XSS (Jinja2 / Twig raw filter) ───────────────
    (
        "Server-side template XSS: Jinja2, Twig, or Mako template uses the raw/"
        "safe filter on user-controlled data to bypass auto-escaping — attacker "
        "injects <script> tags that render as literal HTML in the response",
        # forbidden: raw/safe filter on user input must be gone in safe
        ["Markup(user", "Markup(data", "Markup(input",
         "mark_safe(user", "mark_safe(data", "mark_safe(input",
         "| safe }}", "|safe }}", "autoescape false"],
    ),

    # ── 14. React dangerouslySetInnerHTML ─────────────────────────────────────
    (
        "React dangerouslySetInnerHTML XSS: React component uses "
        "dangerouslySetInnerHTML={{ __html: userContent }} without sanitizing "
        "the content first — attacker injects <img onerror=alert(1)> or script tags",
        # forbidden: dangerouslySetInnerHTML with RAW unsanitized data in safe
        ["__html: userContent", "__html: user_input",
         "dangerouslySetInnerHTML={{ __html: props.content }}"],
    ),
]


# ══════════════════════════════════════════════════════════════════════════════
#  LANGUAGES & FRAMEWORKS — 25 combinations
# ══════════════════════════════════════════════════════════════════════════════
LANG_FRAMEWORKS = [
    # Python
    ("Python",  "Flask + Jinja2"),
    ("Python",  "Django"),
    ("Python",  "FastAPI"),
    ("Python",  "plain Python (http.server)"),
    ("Python",  "aiohttp"),
    # Java
    ("Java",    "Spring Boot + Thymeleaf"),
    ("Java",    "Spring Boot REST"),
    ("Java",    "Jakarta EE / Servlet"),
    ("Java",    "JSP + JSTL"),
    # Node.js
    ("NodeJS",  "Express + EJS"),
    ("NodeJS",  "Express + Handlebars"),
    ("NodeJS",  "NestJS"),
    ("NodeJS",  "plain Node.js (http module)"),
    # PHP
    ("PHP",     "Laravel + Blade"),
    ("PHP",     "Symfony + Twig"),
    ("PHP",     "plain PHP"),
    # Go
    ("Go",      "Gin + html/template"),
    ("Go",      "plain Go net/http"),
    ("Go",      "Echo"),
    # C#
    ("CSharp",  "ASP.NET Core MVC + Razor"),
    ("CSharp",  "ASP.NET Core API"),
    # Ruby
    ("Ruby",    "Rails + ERB"),
    ("Ruby",    "Sinatra"),
    # Kotlin
    ("Kotlin",  "Ktor + FreeMarker"),
    ("Kotlin",  "Spring Boot Kotlin + Thymeleaf"),
]


# ══════════════════════════════════════════════════════════════════════════════
#  BUSINESS CONTEXTS — 20 realistic scenarios
# ══════════════════════════════════════════════════════════════════════════════
CONTEXTS = [
    "user comment display in blog / CMS platform",
    "product review rendering in e-commerce storefront",
    "search results page in internal knowledge base",
    "user profile bio display in social network",
    "error message page in web application",
    "chat message rendering in customer support portal",
    "notification banner in SaaS dashboard",
    "file upload confirmation in document management system",
    "admin log viewer in back-office panel",
    "email preview in marketing automation tool",
    "breadcrumb navigation in e-learning platform",
    "order details page in logistics tracking app",
    "report title display in analytics dashboard",
    "support ticket subject rendering in helpdesk app",
    "announcement board in corporate intranet",
    "forum post display in community platform",
    "product name in invoice PDF generator",
    "webhook payload preview in developer portal",
    "user-generated tag rendering in content tagging system",
    "redirect destination display in OAuth flow",
]


# ══════════════════════════════════════════════════════════════════════════════
#  GLOBAL MITIGATION SIGNALS — Tier 1
# ══════════════════════════════════════════════════════════════════════════════
MITIGATION_SIGNALS = [
    # ── Python ────────────────────────────────────────────────────────────────
    "html.escape(", "cgi.escape(", "escape(", "markupsafe",
    "Markup(", "escape_html(", "bleach.clean(", "bleach.linkify(",
    "jinja2.escape(", "markupsafe.escape(",
    # ── PHP ───────────────────────────────────────────────────────────────────
    "htmlspecialchars(", "htmlentities(", "strip_tags(",
    "ENT_QUOTES", "ENT_HTML5", "filter_var(",
    # ── Node.js / JS ──────────────────────────────────────────────────────────
    "escapeHtml(", "escape-html", "escape(str", "DOMPurify",
    "DOMPurify.sanitize(", "sanitizeHtml(", "xss(", "xss-filters",
    "textContent", "createTextNode(", "innerText",
    "encodeURIComponent(", "encodeURI(",
    "require('escape-html')", "require(\"escape-html\")",
    "require('he')", "require(\"he\")", "he.encode(",
    "validator.escape(", "xssFilters.",
    # ── Java ──────────────────────────────────────────────────────────────────
    "StringEscapeUtils.escapeHtml4(", "StringEscapeUtils.escapeHtml(",
    "HtmlUtils.htmlEscape(", "HtmlEncoder.encode(",
    "ESAPI.encoder().encodeForHTML(", "Encode.forHtml(",
    "Jsoup.clean(", "Whitelist.", "SafeList.",
    "escapeHtml4(", "escapeHtml(", "HtmlEscape(",
    # ── C# ────────────────────────────────────────────────────────────────────
    "HtmlEncoder.Default.Encode(", "HttpUtility.HtmlEncode(",
    "AntiXssEncoder.HtmlEncode(", "WebUtility.HtmlEncode(",
    "HtmlEncode(", "AntiXss.HtmlEncode(", "Encoder.HtmlEncode(",
    # ── Ruby ──────────────────────────────────────────────────────────────────
    "html_escape(", "h(", "CGI.escapeHTML(", "ERB::Util.html_escape(",
    "sanitize(", "ActionView::Base.full_sanitizer",
    "Rack::Utils.escape_html(", "escape_html(",
    # ── Go ────────────────────────────────────────────────────────────────────
    "html.EscapeString(", "template.HTMLEscapeString(",
    "html/template", "template.HTML(", "url.QueryEscape(",
    "text/template", "template.JSEscapeString(",
    # ── Kotlin / JVM ──────────────────────────────────────────────────────────
    "HtmlUtils.htmlEscape(", "StringEscapeUtils.escapeHtml4(",
    "Encode.forHtml(", "escapeHtml(",
    # ── Template auto-escaping ────────────────────────────────────────────────
    "autoescape", "auto_escape", "{{ ", "}}", "{% autoescape",
    "th:text=", "th:utext", "@Html.Encode(", "@Html.Raw(",
    "c:out", "fn:escapeXml(",
    # ── CSP header ────────────────────────────────────────────────────────────
    "Content-Security-Policy", "content_security_policy",
    "X-XSS-Protection", "X-Content-Type-Options",
    # ── DOM-safe alternatives ─────────────────────────────────────────────────
    "textContent", "createTextNode", "innerText",
    "setAttribute(", "setAttributeNode(",
    # ── React safe ────────────────────────────────────────────────────────────
    "DOMPurify.sanitize(", "sanitize(content", "sanitize(data",
    "sanitize(user", "purify.sanitize(",
    # ── Generic validation ────────────────────────────────────────────────────
    "raise", "throw", "abort(", "return nil", "return null",
    "400", "403", "HttpStatus.BAD_REQUEST",
    "allowlist", "whitelist", "ALLOWED_",
    "re.match(", "re.fullmatch(", "re.sub(",
    "Pattern.compile(", "Regex.IsMatch(", "preg_match(",
]

# ══════════════════════════════════════════════════════════════════════════════
#  TIER-2 BROAD SECURITY PATTERNS
# ══════════════════════════════════════════════════════════════════════════════
BROAD_SECURITY = [
    "escape", "Escape", "ESCAPE", "encode", "Encode", "ENCODE",
    "sanitize", "Sanitize", "SANITIZE", "purify", "Purify",
    "htmlspecial", "htmlentities", "htmlencode", "HtmlEncode",
    "textContent", "createTextNode", "innerText",
    "safe", "Safe", "clean", "Clean", "strip", "Strip",
    "validate", "Validate", "allowlist", "whitelist", "ALLOWED",
    "raise", "throw", "abort(", "return null", "return nil",
    "return false", "return False",
    "400", "403", "BadRequest", "Forbidden",
    "CSP", "csp", "nonce", "policy",
    "re.match", "Pattern", "Regex", "preg_match",
    "filter", "Filter",
]

# ══════════════════════════════════════════════════════════════════════════════
#  VULN INDICATORS — must appear in vuln_code
# ══════════════════════════════════════════════════════════════════════════════
VULN_INDICATORS = [
    # ── DOM manipulation ───────────────────────────────────────────────────────
    "innerHTML", "outerHTML", "insertAdjacentHTML(", "insertAdjacentElement(",
    "document.write(", "document.writeln(",
    # ── JavaScript DOM sources ─────────────────────────────────────────────────
    "location.search", "location.hash", "location.href",
    "document.URL", "document.referrer", "document.cookie",
    "window.name", "localStorage.", "sessionStorage.",
    "URLSearchParams(", "searchParams.get(", "params.get(",
    # ── Server-side HTML rendering ────────────────────────────────────────────
    "render_template(", "render(", "render_to_string(",
    "template.render(", "return render(",
    "HttpResponse(", "Response(", "res.send(", "res.end(",
    "res.json(", "res.write(", "response.write(",
    "print(", "echo ", "echo(", "printf(",
    "return f\"<", "return f'<", "return \"<", "return '<",
    "return `<",
    # ── Python specific ───────────────────────────────────────────────────────
    'f"<div', "f'<div", 'f"<p', "f'<p", 'f"<span', "f'<span",
    'f"<h1', "f'<h1", 'f"<h2', "f'<h2",
    'f"<a ', "f'<a ", 'f"<li', "f'<li",
    'f"<td', "f'<td", 'f"<th', "f'<th",
    'f"<input', "f'<input", 'f"<title', "f'<title",
    'f"<script', "f'<script",
    '% comment', '% user', '% name', '% message', '% data',
    '% (comment', '% (user', '% (name',
    ".format(comment", ".format(user", ".format(name",
    ".format(data", ".format(msg", ".format(content",
    # ── PHP specific ──────────────────────────────────────────────────────────
    "echo $", "echo $_", 'echo "' + '<', "echo '<",
    "print $", "print_r($",
    '<?= $', '<?php echo',
    # ── Java/C# template/response ─────────────────────────────────────────────
    "out.print(", "out.println(", "PrintWriter", "response.getWriter(",
    "writer.print(", "writer.write(",
    "@Html.Raw(", "Html.Raw(", "Response.Write(",
    # ── Node.js / JS ──────────────────────────────────────────────────────────
    "res.send(`", 'res.send("', "res.send('<",
    "res.end(`", 'res.end("',
    "${user", "${data", "${input", "${content", "${msg",
    "${comment", "${name", "${param", "${query", "${search",
    "`<div>", "`<p>", "`<span>", "`<h", "`<li>",
    "`<a ", "`<input", "`<title",
    # ── Ruby ──────────────────────────────────────────────────────────────────
    ".html_safe", "raw(", "raw ", "concat(raw",
    "render html:", "render :html",
    '#{comment}', '#{user}', '#{name}', '#{data}',
    '#{input}', '#{content}', '#{msg}', '#{message}',
    # ── Go template ───────────────────────────────────────────────────────────
    "fmt.Fprintf(w,", "fmt.Fprintf(w, \"<",
    "w.Write([]byte(", 'Sprintf("<%',
    # ── Jinja2/Twig unsafe filters ────────────────────────────────────────────
    "| safe", "|safe", "| raw", "|raw",
    "Markup(", "mark_safe(", "{% autoescape false",
    # ── Angular/Vue/React unsafe ──────────────────────────────────────────────
    "dangerouslySetInnerHTML", "v-html=", "[innerHTML]=",
    "bypassSecurityTrustHtml(",
    # ── Event handler injection ───────────────────────────────────────────────
    "onclick=\"" + '"',  "onclick='",
    "onerror=\"", "onerror='",
    "onload=\"", "onload='",
    "onmouseover=\"", "onmouseover='",
    # ── postMessage ───────────────────────────────────────────────────────────
    "addEventListener('message'", 'addEventListener("message"',
    "event.data", "e.data", "message.data",
    # ── SVG / CSS ─────────────────────────────────────────────────────────────
    "<svg", "svg+xml", ".svg",
    "style=\"", "style='", "expression(",
    # ── URL/redirect ──────────────────────────────────────────────────────────
    "location.href =", "window.location =", "location.replace(",
    "redirect(", "Redirect(", "return redirect(",
    # ── Generic string → HTML ─────────────────────────────────────────────────
    '"<' + "div", '"<p', '"<span', '"<script',
    "'<" + "div", "'<p", "'<span", "'<script",
    "+ \"<", '+ \'<', "+ `<",
    "html =", "html +=", "htmlContent",
    "output =", "result =", "content =",
]


# ══════════════════════════════════════════════════════════════════════════════
#  API CLIENT POOL — round-robin, per-key rate-limit
# ══════════════════════════════════════════════════════════════════════════════
_clients = [
    OpenAI(api_key=key, base_url="https://api.cerebras.ai/v1")
    for key in CEREBRAS_KEYS
]
_key_lock   = threading.Lock()
_key_index  = 0
_key_sleep: dict[int, float] = {i: 0.0 for i in range(len(CEREBRAS_KEYS))}


def _next_client() -> tuple[int, "OpenAI"]:
    global _key_index
    with _key_lock:
        now = time.monotonic()
        for _ in range(len(_clients)):
            idx = _key_index % len(_clients)
            _key_index += 1
            if now >= _key_sleep.get(idx, 0):
                return idx, _clients[idx]
        idx = min(_key_sleep, key=lambda k: _key_sleep[k])
        return idx, _clients[idx]


def _sleep_key(idx: int, seconds: float = 62.0):
    with _key_lock:
        _key_sleep[idx] = time.monotonic() + seconds
        print(f"  [LIMIT] key#{idx} sleeping {seconds:.0f}s …")


def call_api(user_msg: str) -> str | None:
    for attempt in range(5):
        idx, client = _next_client()
        wait = _key_sleep.get(idx, 0) - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        try:
            resp = client.chat.completions.create(
                model=CEREBRAS_MODEL,
                max_tokens=620,
                temperature=0.82,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user",   "content": user_msg},
                ],
            )
            return resp.choices[0].message.content
        except Exception as exc:
            msg = str(exc)
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                _sleep_key(idx, 62.0)
            elif "503" in msg or "502" in msg:
                time.sleep(5 * (attempt + 1))
            else:
                if attempt == 4:
                    print(f"  [ERR] key#{idx}: {msg[:80]}")
                time.sleep(2 * (attempt + 1))
    return None


# ══════════════════════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════════════════════
def wp_tokens(text: str) -> int:
    return max(1, int(len(text) / 3.5))


def strip_comments(code: str) -> str:
    code = re.sub(r'#.*',       '',  code)
    code = re.sub(r'//.*',      '',  code)
    code = re.sub(r'/\*.*?\*/', '',  code, flags=re.DOTALL)
    code = re.sub(r'""".*?"""', '',  code, flags=re.DOTALL)
    code = re.sub(r"'''.*?'''", '',  code, flags=re.DOTALL)
    return code


def tokenize(code: str) -> list[str]:
    return re.findall(r'[a-zA-Z_]\w*|[0-9]+', code)


def jaccard(a: list, b: list) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    return len(sa & sb) / (len(sa) + len(sb) - len(sa & sb))


FUNCTION_KEYWORDS = [
    "def ", "func ", "fn ", "function ", "async function",
    "public ", "private ", "protected ", "internal ", "override ",
    "static ", "void ", "async ",
    "const ", "let ", "var ", "module.exports", "exports.",
    "<?php", "fun ", "object ", "class ", "interface ",
    "router.", "app.get(", "app.post(", "app.put(",
    "http.HandleFunc(", "Route::", "@app.route", "@router.",
    "@GetMapping", "@PostMapping", "@RequestMapping",
    " do\n", " do |", "post '", "get '", "post \"", "get \"",
]

def has_function(code: str) -> bool:
    return any(kw in code for kw in FUNCTION_KEYWORDS)


def smart_truncate(code: str, wp_budget: int) -> str:
    lines, kept, total = code.split('\n'), [], 0
    for line in lines:
        cost = wp_tokens(line)
        if total + cost > wp_budget:
            break
        kept.append(line)
        total += cost
    result = '\n'.join(kept)
    if len(kept) < len(lines):
        opens = result.count('{') - result.count('}')
        if opens > 0:
            result += '\n' + '}\n' * opens
    return result


def parse_blocks(text: str) -> tuple[str | None, str | None]:
    text = re.sub(r'\*\*(VULN|SAFE):\*\*', r'\1:', text, flags=re.IGNORECASE)
    text = re.sub(r'```[a-zA-Z]*\n?', '', text)
    text = re.sub(r'```', '', text)
    vm = re.search(r'VULN:\s*\n(.*?)(?=\nSAFE:)', text, re.DOTALL | re.IGNORECASE)
    sm = re.search(r'SAFE:\s*\n(.+)$',             text, re.DOTALL | re.IGNORECASE)
    if not vm or not sm:
        return None, None
    return vm.group(1).strip(), sm.group(1).strip()


# ══════════════════════════════════════════════════════════════════════════════
#  NEAR-DUPLICATE DETECTION
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
#  VALIDATION GATE
# ══════════════════════════════════════════════════════════════════════════════
def validate(vuln: str, safe: str, subtype_tuple: tuple) -> tuple[bool, str]:
    desc, forbidden = subtype_tuple

    if not vuln or not safe:
        return False, "empty block"
    if not has_function(vuln):
        return False, "vuln: no function"
    if not has_function(safe):
        return False, "safe: no function"

    vc, sc = len(vuln), len(safe)
    # Stricter min than old dataset (was 70, causing junk samples)
    if vc < 120:            return False, f"vuln too short ({vc} chars)"
    if vc > 1200:           return False, f"vuln too long ({vc} chars)"
    if sc < 130:            return False, f"safe too short ({sc} chars)"
    if sc > 1300:           return False, f"safe too long ({sc} chars)"
    if vc + sc > MAX_CHARS: return False, f"combined too long ({vc+sc} chars)"

    vwp = wp_tokens(vuln)
    swp = wp_tokens(safe)
    if vwp + swp + 3 > WP_BUDGET + 3:
        return False, f"WP-token overflow ({vwp+swp+3} > 512)"

    vt, st = tokenize(vuln), tokenize(safe)
    if len(vt) < 10:  return False, f"vuln too few identifiers ({len(vt)})"
    if len(st) < 10:  return False, f"safe too few identifiers ({len(st)})"

    sim = jaccard(vt, st)
    if sim < 0.12:    return False, f"pair too dissimilar ({sim:.2f})"
    # XSS fix is also high-J (adds escape call, rest identical)
    # Use 0.995 like SQLi to avoid false rejects
    if sim >= 0.995:  return False, f"pair zero-change ({sim:.2f})"

    vlines = {l.strip() for l in vuln.split('\n') if l.strip()}
    slines = {l.strip() for l in safe.split('\n') if l.strip()}
    if vlines == slines:
        return False, "zero-change: vuln and safe are line-identical"

    # The output/rendering line SHOULD differ — soft check (warn but don't always reject)
    def render_lines(code):
        kw = (
            "innerHTML","outerHTML","document.write","insertAdjacentHTML",
            "render_template(","render(","render_to_string(",
            "res.send(","res.end(","res.json(","Response(","HttpResponse(",
            "echo ","echo(","print(","printf(","print_r(",
            "return f\"<","return f'<","return \"<","return '<","return `<",
            "write(","out.print","dangerouslySetInnerHTML",
            ".html_safe","| safe","|safe","| raw","|raw","Markup(",
            "mark_safe(","fmt.Fprintf(w,","w.Write(",
            "th:text","th:utext","@Html.Raw(","@Html.",
            "v-html=","[innerHTML]=","bypassSecurityTrust",
            "${","#{","f\"<","f'<","`<","render html:",
        )
        return {l.strip() for l in code.split('\n')
                if any(k in l for k in kw) and l.strip()}

    vr = render_lines(vuln)
    sr = render_lines(safe)
    # Only reject if BOTH have render lines AND they're identical AND many lines
    if vr and sr and vr == sr and len(vr) >= 2:
        return False, "rendering/output lines unchanged between vuln and safe"

    # Forbidden patterns
    safe_nc = strip_comments(safe)
    for pat in (forbidden or []):
        if pat in safe_nc:
            return False, f"forbidden pattern still in safe: '{pat}'"

    # ── XSS vuln check — 2-part: user input + HTML output ───────────────────
    USER_INPUT_SIGNALS = [
        "request.args","request.form","request.GET","request.POST",
        "request.json","request.data","request.values",
        "params[","request.params","request.query",
        "$_GET[","$_POST[","$_REQUEST[","$_COOKIE[",
        "$request->","Input::","request()->",
        "req.query","req.params","req.body","req.headers",
        "searchParams","URLSearchParams","params.get(",
        "request.getParameter(","@RequestParam","@PathVariable","@RequestBody",
        "r.URL.Query()","r.FormValue(","c.Query(","c.Param(",
        "c.PostForm(","ctx.QueryParam(",
        "Request.Query[","Request.Form[","Request.QueryString[",
        "[FromQuery]","[FromBody]",
        "params[:","params[\"","request.params","params.fetch",
        "call.parameters[","call.request.queryParameters[",
        "call.receiveText(","call.receive(",
        # generic variable names that carry user data
        "user_input","userInput","user_data","userData",
        "comment","message","username","user_name",
        "search","term","keyword","content","description",
        "title","query","name","text","value","data",
        "payload","input","param","field","msg",
        "post","review","bio","profile",
        # DOM sources
        "location.search","location.hash","location.href",
        "document.URL","document.referrer",
        "window.name","localStorage.","sessionStorage.",
        "event.data","e.data","message.data",
        "URLSearchParams(window.location",
    ]
    HTML_OUTPUT_SIGNALS = [
        # DOM
        "innerHTML","outerHTML","insertAdjacentHTML","document.write",
        # Python
        "render_template(","render(","HttpResponse(",
        "return f\"<","return f'<","return \"<","return '<","return `<",
        "Response(","make_response(",
        # PHP
        "echo ","echo(","print ","print(","print_r(","<?=","printf(",
        # Node.js
        "res.send(","res.end(","res.write(","res.json(",
        "reply.send(","reply.html(",
        # Java/Kotlin
        "out.print(","out.println(","response.getWriter(","writer.print(",
        "ResponseEntity","ok().body(",
        # C#
        "@Html.Raw(","Html.Raw(","Response.Write(","return Content(",
        # Ruby
        ".html_safe","render html:","render :html","render inline:",
        # Go
        "fmt.Fprintf(w","w.Write(","c.String(","c.HTML(",
        "ctx.HTML(","ctx.String(",
        # String interpolation into HTML
        'f"<','f\'<','`<','${','#{',".format(",
        # Unsafe template
        "| safe","|safe","| raw","|raw",
        "Markup(","mark_safe(","dangerouslySetInnerHTML","v-html=",
        "bypassSecurityTrust",
        # Generic HTML
        '"<p>','\'<p>','"<div>','\'<div>','+ "<','+ \'<',
        "htmlContent","htmlString","<script>","<img ",
    ]
    has_input  = any(s in vuln for s in USER_INPUT_SIGNALS)
    has_output = any(s in vuln for s in HTML_OUTPUT_SIGNALS)
    # Soft check: warn only if NEITHER input nor output signals found
    # This avoids false rejections for valid XSS patterns in less common frameworks
    if not has_input and not has_output:
        return False, "vuln lacks any XSS signals (no user input or HTML output)"

    # 3-TIER MITIGATION CHECK
    tier1 = any(sig in safe for sig in MITIGATION_SIGNALS)
    tier2 = any(pat in safe for pat in BROAD_SECURITY)

    new_lines = [
        l for l in slines - vlines
        if len(l) > 8
        and not l.startswith(('#', '//', 'import ', 'from ', 'using ',
                               'require ', 'package '))
    ]
    tier3 = len(new_lines) >= 1

    if not (tier1 or tier2 or tier3):
        snippet = safe[:100].replace('\n', ' | ')
        return False, f"no XSS mitigation detected — snippet: {snippet}"

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
#  PROMPT BUILDER — includes output context for diversity
# ══════════════════════════════════════════════════════════════════════════════
def build_user_msg(subtype_desc: str, lang: str, fw: str,
                   ctx: str, out_ctx: str) -> str:
    return (
        f"Language: {lang}\n"
        f"Framework: {fw}\n"
        f"Vulnerability subtype: {subtype_desc}\n"
        f"Business context: {ctx}\n"
        f"Output context (where user data appears): {out_ctx}\n\n"
        "Requirements:\n"
        "- VULN: 8–16 lines, ~200–420 chars. ONE XSS weakness.\n"
        "- VULN must render user input DIRECTLY into HTML/JS output\n"
        "  matching the specified output context WITHOUT encoding.\n"
        "- SAFE: 10–20 lines, ~230–490 chars. Fix ONLY the XSS flaw.\n"
        "- Combined VULN + SAFE must be UNDER 1700 CHARACTERS.\n"
        "- Same function name and parameters in both blocks.\n"
        "- Include minimal necessary imports only.\n"
        "- Safe mitigation: use html.escape(), htmlspecialchars(),\n"
        "  escapeHtml(), HtmlEncoder.encode(), textContent, DOMPurify,\n"
        "  or template auto-escaping — NOT input length validation.\n"
        "- The output line MUST visibly differ between VULN and SAFE."
    )


# ══════════════════════════════════════════════════════════════════════════════
#  PROCESS ONE COMBO — parallel worker
# ══════════════════════════════════════════════════════════════════════════════
def process_combo(subtype_tuple, lang, fw, ctx, out_ctx) -> dict | None:
    subtype_desc = subtype_tuple[0]
    user_msg = build_user_msg(subtype_desc, lang, fw, ctx, out_ctx)
    raw = call_api(user_msg)
    if not raw:
        return None

    vuln, safe = parse_blocks(raw)
    if not vuln or not safe:
        return None

    # Char overflow truncation
    combined = len(vuln) + len(safe)
    if combined > MAX_CHARS:
        vc, sc = len(vuln), len(safe)
        v_cb  = max(240, int(MAX_CHARS * vc / max(vc + sc, 1)))
        sf_cb = MAX_CHARS - v_cb
        if vc > v_cb:
            vuln = smart_truncate(vuln, max(65, v_cb // 4))
        if sc > sf_cb:
            safe = smart_truncate(safe, max(70, sf_cb // 4))

    # WP overflow truncation
    total_wp = wp_tokens(vuln) + wp_tokens(safe) + 3
    if total_wp > WP_BUDGET + 3:
        vwp = wp_tokens(vuln)
        swp = wp_tokens(safe)
        vb  = max(65, int(WP_BUDGET * vwp / max(vwp + swp, 1)))
        sb  = WP_BUDGET - vb
        if vwp > vb: vuln = smart_truncate(vuln, vb)
        if swp > sb: safe = smart_truncate(safe, sb)

    ok, reason = validate(vuln, safe, subtype_tuple)
    if not ok:
        return {"_skip": reason}

    return {
        "vuln_code":       vuln,
        "state":           "XSS",
        "safe_code":       safe,
        "safe_code_label": "Safe",
        "_subtype":        subtype_desc[:60],
        "_lang":           lang,
        "_framework":      fw,
        "_context":        ctx,
        "_output_ctx":     out_ctx[:50],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main() -> None:
    samples = load_checkpoint()
    kept    = len(samples)

    fingerprints: list[frozenset] = [ngrams(s["vuln_code"]) for s in samples]
    fp_lock = threading.Lock()

    subtype_counts  = defaultdict(int)
    lang_counts     = defaultdict(int)
    context_counts  = defaultdict(int)
    outctx_counts   = defaultdict(int)
    for s in samples:
        subtype_counts[s.get("_subtype", "")]    += 1
        lang_counts[s.get("_lang", "")]          += 1
        context_counts[s.get("_context", "")]    += 1
        outctx_counts[s.get("_output_ctx", "")]  += 1

    # Build combos — include output_context for extra diversity
    combos = [
        (sub, lang, fw, ctx, out_ctx)
        for sub in SUBTYPES
        for (lang, fw) in LANG_FRAMEWORKS
        for ctx in CONTEXTS
        for out_ctx in random.sample(OUTPUT_CONTEXTS, 2)
    ]
    random.shuffle(combos)
    total_combos = len(combos)
    combo_idx    = kept % total_combos
    skipped = errors = 0

    print(f"╔════════════════════════════════════════╗")
    print(f"║   XSS Dataset Generator                ║")
    print(f"╚════════════════════════════════════════╝")
    print(f"  Loaded from checkpoint : {kept}")
    print(f"  Target                 : {TARGET}")
    print(f"  Total combos           : {total_combos:,}")
    print(f"  Subtypes               : {len(SUBTYPES)}")
    print(f"  Lang/FW combos         : {len(LANG_FRAMEWORKS)}")
    print(f"  Business contexts      : {len(CONTEXTS)}")
    print(f"  Output contexts        : {len(OUTPUT_CONTEXTS)}")
    print(f"  API keys (parallel)    : {len(CEREBRAS_KEYS)}")
    print()

    with ThreadPoolExecutor(max_workers=BATCH_SIZE) as executor:
        while kept < TARGET:

            batch = []
            attempts = 0
            while len(batch) < BATCH_SIZE and kept + len(batch) < TARGET:
                item = combos[combo_idx % total_combos]
                combo_idx += 1
                attempts += 1
                if attempts > total_combos * 2:
                    break

                subtype_tuple, lang, fw, ctx, out_ctx = item
                sub_desc = subtype_tuple[0]

                # Soft balance on subtype
                avg_sub = kept / max(len(SUBTYPES), 1)
                if subtype_counts[sub_desc] > avg_sub * 1.4 and kept > 50:
                    skipped += 1
                    continue

                # Soft balance on output context
                avg_oc = kept / max(len(OUTPUT_CONTEXTS), 1)
                if outctx_counts[out_ctx[:50]] > avg_oc * 2.5 and kept > 100:
                    continue

                batch.append(item)

            if not batch:
                break

            futures = {
                executor.submit(process_combo, st, la, fw, ctx, oc): (st, la, fw, ctx, oc)
                for st, la, fw, ctx, oc in batch
            }

            for future in as_completed(futures):
                subtype_tuple, lang, fw, ctx, out_ctx = futures[future]
                sub_desc = subtype_tuple[0]

                try:
                    result = future.result()
                except Exception as exc:
                    print(f"  [ERR] {exc}")
                    errors += 1; skipped += 1
                    continue

                if result is None:
                    errors += 1; skipped += 1
                    continue

                if "_skip" in result:
                    print(f"  [SKIP] {result['_skip']}")
                    skipped += 1
                    continue

                fp = ngrams(result["vuln_code"])
                with fp_lock:
                    if is_near_dup(fp, fingerprints):
                        print(f"  [DUP]  near-duplicate rejected")
                        skipped += 1
                        continue
                    fingerprints.append(fp)

                subtype_counts[sub_desc]        += 1
                lang_counts[lang]               += 1
                context_counts[ctx]             += 1
                outctx_counts[out_ctx[:50]]     += 1
                samples.append(result)
                kept += 1

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

    # Final save
    save_checkpoint(samples)
    final = [{k: v for k, v in s.items() if not k.startswith("_")} for s in samples]
    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for s in final:
            f.write(json.dumps(s, ensure_ascii=False) + "\n")

    print()
    print(f"╔════════════════════════════════════════╗")
    print(f"║  DONE — {kept} samples saved            ║")
    print(f"╚════════════════════════════════════════╝")
    print(f"  Output  : {OUTPUT_FILE}")
    print(f"  Skipped : {skipped}")
    print(f"  Errors  : {errors}")
    print()
    print("  Subtype distribution:")
    for k, v in sorted(subtype_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k[:68]}")
    print()
    print("  Language distribution:")
    for k, v in sorted(lang_counts.items(), key=lambda x: -x[1]):
        print(f"    {v:>4}  {k}")
    print()
    print("  Output context distribution (top 10):")
    for k, v in sorted(outctx_counts.items(), key=lambda x: -x[1])[:10]:
        print(f"    {v:>4}  {k}")


if __name__ == "__main__":
    main()
