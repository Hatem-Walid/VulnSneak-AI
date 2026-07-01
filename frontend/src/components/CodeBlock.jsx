import { useState, useRef, useEffect, memo, useCallback } from "react";
import { Copy, Check, ChevronDown, ChevronUp, AlertTriangle, FileCode, Code2 } from "lucide-react";

// ─── LANGUAGE CONFIG ──────────────────────────────────────────────────────────
const LANG_META = {
  js:      { prism: 'javascript', label: 'JavaScript', color: '#f0b429', textColor: '#fbbf24' },
  jsx:     { prism: 'jsx',        label: 'JSX',        color: '#38bdf8', textColor: '#7dd3fc' },
  ts:      { prism: 'typescript', label: 'TypeScript', color: '#38bdf8', textColor: '#7dd3fc' },
  tsx:     { prism: 'tsx',        label: 'TSX',        color: '#38bdf8', textColor: '#7dd3fc' },
  py:      { prism: 'python',     label: 'Python',     color: '#4f8ef7', textColor: '#93c5fd' },
  sql:     { prism: 'sql',        label: 'SQL',        color: '#34d399', textColor: '#6ee7b7' },
  json:    { prism: 'json',       label: 'JSON',       color: '#fb923c', textColor: '#fdba74' },
  java:    { prism: 'java',       label: 'Java',       color: '#f97316', textColor: '#fdba74' },
  c:       { prism: 'c',          label: 'C',          color: '#a78bfa', textColor: '#c4b5fd' },
  cpp:     { prism: 'cpp',        label: 'C++',        color: '#a78bfa', textColor: '#c4b5fd' },
  go:      { prism: 'go',         label: 'Go',         color: '#2dd4bf', textColor: '#5eead4' },
  rs:      { prism: 'rust',       label: 'Rust',       color: '#fb923c', textColor: '#fdba74' },
  css:     { prism: 'css',        label: 'CSS',        color: '#f472b6', textColor: '#f9a8d4' },
  html:    { prism: 'markup',     label: 'HTML',       color: '#f97316', textColor: '#fdba74' },
  php:     { prism: 'php',        label: 'PHP',        color: '#8b5cf6', textColor: '#c4b5fd' },
  default: { prism: 'javascript', label: 'Code',       color: '#8b8b9e', textColor: '#a1a1b5' },
};

const LANG_KEYWORDS = {
  py:   ['def','class','import','from','if','else','elif','for','while','return','True','False','None','and','or','not','in','is','lambda','try','except','finally','with','as','pass','break','continue','raise','yield','async','await','self','print','len','range'],
  js:   ['const','let','var','function','return','if','else','for','while','class','import','export','default','new','this','typeof','null','undefined','true','false','async','await','try','catch','finally','throw','switch','case','break','continue','delete','void','of','instanceof','extends','super','static','from'],
  ts:   ['const','let','var','function','return','if','else','for','while','class','import','export','default','new','this','typeof','null','undefined','true','false','async','await','try','catch','finally','throw','interface','type','enum','implements','extends','abstract','readonly','private','public','protected','static','any','string','number','boolean','never'],
  cpp:  ['int','float','double','char','void','bool','auto','const','return','if','else','for','while','do','switch','case','break','continue','class','struct','public','private','protected','virtual','override','namespace','using','include','define','template','typename','nullptr','true','false','new','delete','static','inline','cout','cin'],
  java: ['public','private','protected','class','interface','extends','implements','return','if','else','for','while','do','switch','case','break','continue','try','catch','finally','throw','new','this','super','static','final','abstract','void','int','boolean','String','null','true','false','import','package'],
  sql:  ['SELECT','FROM','WHERE','JOIN','ON','GROUP','ORDER','BY','HAVING','INSERT','UPDATE','DELETE','CREATE','TABLE','DROP','ALTER','INDEX','AND','OR','NOT','IN','LIKE','BETWEEN','AS','LIMIT','OFFSET','UNION','ALL','DISTINCT','COUNT','SUM','AVG','MAX','MIN'],
  default: ['function','return','if','else','for','while','class','const','let','var','import','export','new','null','true','false'],
};

// ─── ENTITY DECODER ───────────────────────────────────────────────────────────
function decodeHTMLEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function getLangMeta(filename) {
  const ext = (filename || '').split('.').pop().toLowerCase();
  return LANG_META[ext] || LANG_META.default;
}

function detectLanguage(code) {
  const c = code.trim();
  if (/^\s*<[!?]?[a-zA-Z]/.test(c) || /<\/[a-zA-Z]+>/.test(c)) return 'html';
  if (/^\s*\{/.test(c) && /"[^"]+"\s*:/.test(c)) return 'json';
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE)\s/i.test(c)) return 'sql';
  if (c.includes('#include') || c.includes('std::') || /\bnamespace\s+\w+/.test(c)) return 'cpp';
  if (/\bpublic\s+class\b|\bSystem\.out\b/.test(c)) return 'java';
  if (/\bdef\s+\w+\s*\(|^\s*import\s+\w+$|:$|elif\s|self\./m.test(c)) return 'py';
  if (/\bfunc\s+\w+\s*\(|fmt\.|package\s+main/.test(c)) return 'go';
  if (/\bfn\s+\w+\s*\(|let\s+mut\s|impl\s+\w+/.test(c)) return 'rs';
  if (/interface\s+\w+|:\s*(string|number|boolean|void)\b/.test(c)) return 'ts';
  if (/=>|const\s+\w+\s*=|require\(/.test(c)) return 'js';
  return 'js';
}

function normalizeCode(code) {
  if (!code) return '';
  const decoded = decodeHTMLEntities(code);
  const lines = decoded.split('\n');
  const indents = lines.filter(l => l.trim().length > 0).map(l => l.match(/^(\s*)/)[1].length);
  const minIndent = indents.length ? Math.min(...indents) : 0;
  return lines.map(l => l.length >= minIndent ? l.slice(minIndent) : l).join('\n').replace(/\t/g, '  ').trimEnd();
}

function highlightLine(line, lang) {
  const kws = LANG_KEYWORDS[lang] || LANG_KEYWORDS.default;

  // ★ كشف ما إذا كان السطر يحتوي على وسوم تلوين وتنسيق HTML جاهزة من الشات بوت
  const hasHTMLHighlights = /<span|<div|<\/span|<\/div>/i.test(line);

  if (hasHTMLHighlights) {
    // نقوم فقط بفك رموز الـ Entities لتمكين المتصفح من رندرتها كأكواد تلوين حقيقية
    return decodeHTMLEntities(line);
  }

  // Decode any residual entities before re-encoding for safe HTML output
  const decoded = decodeHTMLEntities(line);
  let out = decoded.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Comments first (before other processing)
  const commentMatch = out.match(/^(.*?)(\/\/[^\n]*)$/) || out.match(/^(.*?)(#(?!include)[^\n]*)$/);
  let commentSuffix = '';
  if (commentMatch) { out = commentMatch[1]; commentSuffix = `<span style="color:#4b6070;font-style:italic">${commentMatch[2]}</span>`; }

  // Strings (تم إصلاح خطأ الـ RegExp هنا)
  out = out.replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
    '<span style="color:#a8cc8c">$1</span>');
  // Numbers
  out = out.replace(/(?<![a-zA-Z_])\b(\d+\.?\d*)\b/g, '<span style="color:#e8a87c">$1</span>');
  // Keywords
  kws.forEach(kw => {
    out = out.replace(new RegExp(`\\b(${kw})\\b`, 'g'), '<span style="color:#c792ea">$1</span>');
  });
  // Function calls (after keyword coloring, to avoid double-coloring)
  out = out.replace(/\b([a-zA-Z_]\w*)\s*(?=\()/g, (m, fn) => {
    if (kws.includes(fn)) return m;
    return `<span style="color:#82aaff">${fn}</span>`;
  });
  // Operators
  out = out.replace(/([=+\-*/<>!&|^~%]+)/g, '<span style="color:#89ddff">$1</span>');

  return out + commentSuffix;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CODEBLOCK_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap');

  .vs-cb {
    --cb-bg: #09090e; /* ★ تم تحديث لون الخلفية الأساسي ليكون داكناً وأنيقاً */
    --cb-surface: rgba(255,255,255,0.015);
    --cb-border: rgba(255,255,255,0.05);
    --cb-line-hover: rgba(255,255,255,0.025);
    font-family: 'JetBrains Mono', monospace;
    color: #e4e4e7 !important; /* ★ لون ثابت وفائق الوضوح ومريح للقراءة للنصوص العادية */
  }

  .vs-cb code {
    color: #e4e4e7 !important; /* تلوين ثابت لوسوم الأكواد لمنع تداخل ألوان الموقع */
  }

  .vs-cb::-webkit-scrollbar { width: 3px; height: 3px; }
  .vs-cb::-webkit-scrollbar-track { background: transparent; }
  .vs-cb::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 99px; }

  @keyframes vuln-blink {
    0%, 100% { opacity: 0.6; box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50% { opacity: 1; box-shadow: 0 0 8px 2px rgba(239,68,68,0.3); }
  }
  .vuln-dot-blink { animation: vuln-blink 2s ease-in-out infinite; }

  @keyframes line-in {
    from { opacity: 0; transform: translateX(-6px); }
    to { opacity: 1; transform: translateX(0); }
  }
  .line-in { animation: line-in 0.08s ease forwards; }

  @keyframes shimmer-btn {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
`;

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default memo(function CodeBlock({
  code,
  filename = 'source.js',
  vulnLines = [],
  animated = false,
  maxHeight = 400,
  showLangOverride,
}) {
  const normalized = normalizeCode(code || '');
  const ext = filename.split('.').pop();
  const lang = showLangOverride || ext || detectLanguage(normalized);
  const meta = LANG_META[lang] || LANG_META.default;
  const allLines = normalized.split('\n');

  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [visible, setVisible] = useState(animated ? 0 : allLines.length);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!animated) { setVisible(allLines.length); return; }
    setVisible(0);
    let i = 0;
    const id = setInterval(() => {
      i += 3;
      setVisible(i);
      if (i >= allLines.length) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  }, [code, animated, allLines.length]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(normalized).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [normalized]);

  const vulnSet = new Set(vulnLines);
  const hasVulns = vulnLines.length > 0;

  return (
    <div className="vs-cb" style={{
      borderRadius: 16,
      border: hasVulns ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.06)',
      background: '#07090f',
      overflow: 'hidden',
      boxShadow: hasVulns
        ? '0 0 0 1px rgba(239,68,68,0.06), 0 24px 60px rgba(0,0,0,0.6)'
        : '0 24px 60px rgba(0,0,0,0.5)',
    }}>
      <style>{CODEBLOCK_STYLES}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'rgba(7,9,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(16px)',
      }}>
        {/* Left side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Traffic lights */}
          <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
            {[['#ef4444','0.45'],['#f59e0b','0.45'],['#10b981','0.45']].map(([c, o], i) => (
              <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: o }} />
            ))}
          </div>

          {/* File info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderLeft: '1px solid rgba(255,255,255,0.08)', paddingLeft: 12 }}>
            <FileCode size={12} style={{ color: meta.textColor }} />
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: meta.textColor, fontWeight: 500 }}>
              {filename}
            </span>
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              fontSize: 8, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
              background: `${meta.color}18`, color: meta.textColor,
              border: `1px solid ${meta.color}28`,
              fontFamily: 'JetBrains Mono, monospace',
            }}>{meta.label}</span>
          </div>

          {/* Vuln badge */}
          {hasVulns && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 999,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              fontSize: 8, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase',
              color: '#f87171', fontFamily: 'JetBrains Mono, monospace',
            }}>
              <AlertTriangle size={9} /> {vulnLines.length} VULN
            </div>
          )}
        </div>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'JetBrains Mono, monospace', marginRight: 4 }}>
            {allLines.length}L
          </span>
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,0.2)', padding: '4px 6px',
              borderRadius: 6, display: 'flex', alignItems: 'center',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.2)'}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
          <button
            onClick={handleCopy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7,
              background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: copied ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(255,255,255,0.08)',
              color: copied ? '#34d399' : 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
              fontFamily: 'JetBrains Mono, monospace',
              transition: 'all 0.2s ease',
            }}
          >
            {copied
              ? <><Check size={10} /> Copied</>
              : <><Copy size={10} /> Copy</>
            }
          </button>
        </div>
      </div>

      {/* Code area */}
      {!collapsed && (
        <div>
          <div ref={containerRef} style={{ overflowX: 'auto', overflowY: 'auto', maxHeight, position: 'relative' }}
            className="vs-cb">
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12.5, lineHeight: 1.75,
            }}>
              <tbody>
                {allLines.slice(0, visible).map((line, i) => {
                  const lineNum = i + 1;
                  const isVuln = vulnSet.has(lineNum);

                  return (
                    <tr
                      key={i}
                      className={animated ? 'line-in' : ''}
                      style={{
                        animationDelay: animated ? `${Math.min(i * 20, 1000)}ms` : '0ms',
                        background: isVuln
                          ? 'rgba(239,68,68,0.06)'
                          : hovered === lineNum ? 'rgba(255,255,255,0.02)' : 'transparent',
                        borderLeft: isVuln
                          ? '2.5px solid #ef4444'
                          : '2.5px solid transparent',
                        transition: 'background 0.1s ease',
                      }}
                      onMouseEnter={() => setHovered(lineNum)}
                      onMouseLeave={() => setHovered(null)}
                    >
                      {/* Line number */}
                      <td style={{
                        width: 48, textAlign: 'right', verticalAlign: 'top',
                        padding: '1px 12px 1px 8px',
                        color: isVuln ? '#ef4444' : 'rgba(255,255,255,0.12)',
                        userSelect: 'none',
                        borderRight: '1px solid rgba(255,255,255,0.04)',
                        fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                        whiteSpace: 'nowrap',
                      }}>
                        {isVuln && (
                          <span className="vuln-dot-blink" style={{
                            display: 'inline-block', width: 5, height: 5,
                            borderRadius: '50%', background: '#ef4444',
                            marginRight: 5, verticalAlign: 'middle',
                          }} />
                        )}
                        {lineNum}
                      </td>

                      {/* Code content */}
                      <td style={{
                        padding: '1px 24px 1px 14px',
                        whiteSpace: 'pre',
                        verticalAlign: 'top',
                      }}>
                        {isVuln && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 3,
                            background: 'rgba(239,68,68,0.15)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            padding: '0 6px', borderRadius: 4,
                            fontSize: 8, fontWeight: 700,
                            color: '#f87171', marginRight: 10,
                            letterSpacing: '0.08em',
                            fontFamily: 'JetBrains Mono, monospace',
                          }}>
                            ⚠ VULN
                          </span>
                        )}
                        <code dangerouslySetInnerHTML={{ __html: highlightLine(line, lang) }}
                          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px',
            borderTop: '1px solid rgba(255,255,255,0.04)',
            background: 'rgba(0,0,0,0.25)',
          }}>
            <span style={{
              fontSize: 9, color: 'rgba(255,255,255,0.12)',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.25em', textTransform: 'uppercase',
            }}>
              secure_inference_node
            </span>
            {hasVulns && (
              <span style={{
                fontSize: 9, color: '#f87171',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.12em', textTransform: 'uppercase',
                opacity: 0.7,
              }}>
                {vulnLines.length} vulnerabilit{vulnLines.length === 1 ? 'y' : 'ies'} flagged
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});