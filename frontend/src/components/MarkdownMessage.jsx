import { memo, useMemo, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { Copy, Check } from "lucide-react";

// Reuses the CodeBlock component you already built (filename, language badge,
// copy button, collapse, syntax highlighting, theme-awareness, etc).
// 👉 ADJUST THIS PATH to wherever CodeBlock.jsx actually lives in your project.
import CodeBlock from "./CodeBlock";

// ─────────────────────────────────────────────────────────────────────────────
// Map common fenced-code language tags (```javascript, ```python, ...) onto
// the short keys your CodeBlock/LANG_META table already understands.
// ─────────────────────────────────────────────────────────────────────────────
const LANG_ALIASES = {
  javascript: "js", node: "js", jsx: "jsx",
  typescript: "ts", tsx: "tsx",
  python: "py", py3: "py",
  "c++": "cpp", cplusplus: "cpp",
  "c#": "cs", csharp: "cs",
  shell: "bash", sh: "bash", zsh: "bash",
  yml: "yaml",
  md: "markdown",
};

function normalizeLang(raw) {
  if (!raw) return "";
  const l = raw.toLowerCase();
  return LANG_ALIASES[l] || l;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bidi helpers — model responses mix Arabic/RTL prose with English/code.
// Inline code is always force-isolated as LTR; block-level elements get
// dir="auto" so the browser reads each paragraph's own leading character.
// ─────────────────────────────────────────────────────────────────────────────
const RTL_RE = /[\u0590-\u08FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;

function leadDir(node) {
  const text =
    typeof node === "string"
      ? node
      : Array.isArray(node)
      ? node.map((n) => (typeof n === "string" ? n : "")).join("")
      : "";
  for (const ch of text) {
    if (RTL_RE.test(ch)) return "rtl";
    if (/[A-Za-z]/.test(ch)) return "ltr";
  }
  return "auto";
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline code pill
// ─────────────────────────────────────────────────────────────────────────────
function InlineCode({ children }) {
  return (
    <code
      dir="ltr"
      style={{ unicodeBidi: "isolate" }}
      className="px-[6px] py-[2px] mx-[1px] rounded-md text-[0.85em] font-mono
                 bg-white/[0.08] [[data-theme=light]_&]:bg-black/[0.06]
                 text-purple-300 [[data-theme=light]_&]:text-purple-700
                 border border-white/[0.06] [[data-theme=light]_&]:border-black/[0.06]"
    >
      {children}
    </code>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Fallback fenced-code renderer, used only if CodeBlock.jsx can't be resolved.
// Keeping this here means the component still works even before you fix the
// import path above — delete it once CodeBlock is wired up if you prefer.
// ─────────────────────────────────────────────────────────────────────────────
function FallbackCodeFence({ lang, code }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }, [code]);

  return (
    <div
      dir="ltr"
      className="not-prose my-4 rounded-2xl overflow-hidden border border-white/10
                 [[data-theme=light]_&]:border-black/10 bg-[#07090f]
                 [[data-theme=light]_&]:bg-[#f4f4f8] shadow-xl"
    >
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03]
                       [[data-theme=light]_&]:bg-black/[0.04] border-b border-white/5
                       [[data-theme=light]_&]:border-black/[0.08]">
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-zinc-500">
          {lang || "text"}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest
                     text-zinc-500 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check size={11} className="text-emerald-500" /> Copied
            </>
          ) : (
            <>
              <Copy size={11} /> Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-5 py-4 text-[12.5px] leading-relaxed font-mono
                       text-zinc-200 [[data-theme=light]_&]:text-zinc-800">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Extract { lang, code } out of the <pre><code className="language-x">…</code></pre>
// tree react-markdown hands us. We override `pre`, not `code`, because
// react-markdown v9+ no longer reliably passes an `inline` flag to the code
// renderer — inspecting the pre/code wrapper is the only version-proof way
// to tell a fenced block apart from inline code.
// ─────────────────────────────────────────────────────────────────────────────
function extractCodeProps(children) {
  const child = Array.isArray(children) ? children[0] : children;
  if (!child || !child.props) {
    return { lang: "", code: String(children ?? "") };
  }
  const { className, children: codeChildren } = child.props;
  const match = /language-([\w+-]+)/.exec(className || "");
  const raw = Array.isArray(codeChildren) ? codeChildren.join("") : String(codeChildren ?? "");
  return { lang: match ? match[1] : "", code: raw.replace(/\n$/, "") };
}

function buildComponents(CodeBlockImpl) {
  return {
    p: ({ children }) => (
      <p dir={leadDir(children)} className="mb-4 last:mb-0 leading-[1.85] text-start">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-white [[data-theme=light]_&]:text-black">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-zinc-300 [[data-theme=light]_&]:text-zinc-700">{children}</em>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 ps-5 space-y-2 list-disc marker:text-purple-500/70 text-start">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 ps-5 space-y-2 list-decimal marker:text-purple-500/70 text-start">{children}</ol>
    ),
    li: ({ children }) => (
      <li dir={leadDir(children)} className="leading-[1.75] ps-1">
        {children}
      </li>
    ),
    h1: ({ children }) => (
      <h1 dir={leadDir(children)} className="text-xl font-bold mt-7 mb-3 first:mt-0 font-space tracking-tight text-white [[data-theme=light]_&]:text-black text-start">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 dir={leadDir(children)} className="text-lg font-bold mt-6 mb-3 first:mt-0 font-space tracking-tight text-white [[data-theme=light]_&]:text-black text-start">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 dir={leadDir(children)} className="text-base font-bold mt-5 mb-2 first:mt-0 font-space tracking-tight text-white [[data-theme=light]_&]:text-black text-start">
        {children}
      </h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-s-2 border-purple-500/40 ps-4 my-4 text-zinc-400 [[data-theme=light]_&]:text-zinc-600">
        {children}
      </blockquote>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-purple-400 [[data-theme=light]_&]:text-purple-700 underline underline-offset-2
                   decoration-purple-500/40 hover:text-purple-300 transition-colors"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-6 border-white/10 [[data-theme=light]_&]:border-black/10" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-xl border border-white/10 [[data-theme=light]_&]:border-black/10">
        <table className="w-full text-sm border-collapse">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="bg-white/[0.04] [[data-theme=light]_&]:bg-black/[0.03]">{children}</thead>,
    th: ({ children }) => (
      <th className="text-start px-4 py-2 font-bold text-zinc-300 [[data-theme=light]_&]:text-zinc-800 border-b border-white/10 [[data-theme=light]_&]:border-black/10">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-zinc-400 [[data-theme=light]_&]:text-zinc-600 border-b border-white/5 [[data-theme=light]_&]:border-black/5">
        {children}
      </td>
    ),
    pre({ children }) {
      const { lang, code } = extractCodeProps(children);
      const shortLang = normalizeLang(lang);
      if (CodeBlockImpl) {
        return (
          <CodeBlockImpl
            code={code}
            filename={`response.${shortLang || "txt"}`}
            showLangOverride={shortLang || undefined}
            maxHeight={420}
          />
        );
      }
      return <FallbackCodeFence lang={shortLang} code={code} />;
    },
    code({ children }) {
      // Block code is intercepted by `pre` above, so anything reaching here
      // is genuinely inline code (e.g. `clientId`).
      return <InlineCode>{children}</InlineCode>;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MarkdownMessage — drop-in replacement for raw text / TypewriterText
// ─────────────────────────────────────────────────────────────────────────────
function MarkdownMessage({ content, className = "" }) {
  const components = useMemo(() => buildComponents(CodeBlock), []);

  return (
    <div
      dir="auto"
      className={`text-[16px] font-light text-zinc-200 [[data-theme=light]_&]:text-zinc-800
                  leading-[1.85] max-w-none ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
        {content || ""}
      </ReactMarkdown>
    </div>
  );
}

export default memo(MarkdownMessage);
