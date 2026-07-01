import { useState, useRef, useEffect, memo, Suspense, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal, Shield, Zap, Plus, Trash2,
  Download, Edit3, LogOut, Cpu, Activity,
  Globe, Lock, Box, ChevronRight, Hash,
  Layers, Radio, Fingerprint, Command, ShieldAlert, X,
  Loader2, Sparkles, FileCode, Code2, Check, Copy, ChevronDown, ChevronUp, AlertTriangle,
  Bug, MessageSquare, Maximize2, Minimize2, FileText
} from "lucide-react";
import Spline from "@splinetool/react-spline";

import apiClient, {
  getAllChats, getChatMessages, createChat, deleteChat, renameChat
} from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import MarkdownMessage from "../components/MarkdownMessage";
import CodeBlock from "../components/CodeBlock";

// ─────────────────────────────────────────────────────────────────────────────
// 1. ENTITY DECODER
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// 2. SYNTAX HIGHLIGHTER
// ─────────────────────────────────────────────────────────────────────────────

const KW = {
  js: new Set([
    "const","let","var","function","class","import","export","from","if","else",
    "for","while","do","return","async","await","try","catch","finally","throw",
    "new","this","typeof","instanceof","void","delete","null","undefined","true",
    "false","break","continue","switch","case","default","of","in","yield","super",
    "extends","static","get","set","interface","type","enum","declare","abstract",
  ]),
  py: new Set([
    "def","class","import","from","if","elif","else","for","while","return","try",
    "except","finally","with","as","pass","None","True","False","and","or","not",
    "in","is","lambda","yield","raise","break","continue","global","nonlocal",
    "assert","del","print","async","await",
  ]),
  cpp: new Set([
    "int","float","double","char","bool","void","string","auto","const","static",
    "class","struct","if","else","for","while","do","return","using","namespace",
    "new","delete","nullptr","true","false","public","private","protected",
    "virtual","override","include","define","typedef","template","typename",
    "operator","sizeof","enum","union","extern","inline","volatile","register",
  ]),
};
KW["js/ts"] = KW.js;
KW["ts"]    = KW.js;
KW["tsx"]   = KW.js;
KW["jsx"]   = KW.js;
KW["html"]  = new Set(["<!DOCTYPE","html","head","body","div","span","p","a","img","script","style","meta","link","input","button","form","table","tr","td","th","ul","ol","li","h1","h2","h3"]);
KW["css"]   = new Set(["display","position","flex","grid","margin","padding","color","background","border","font","width","height","top","left","right","bottom","z-index","opacity","transform","transition","animation"]);

const TOKEN_COLORS = {
  keyword   : "var(--tok-keyword,   #a78bfa)",
  builtin   : "var(--tok-builtin,   #67e8f9)",
  string    : "var(--tok-string,    #34d399)",
  comment   : "var(--tok-comment,   #6b7280)",
  number    : "var(--tok-number,    #fbbf24)",
  func      : "var(--tok-func,      #fde68a)",
  operator  : "var(--tok-operator,  #94a3b8)",
  attribute : "var(--tok-attribute, #f9a8d4)",
  tag       : "var(--tok-tag,       #60a5fa)",
  plain     : "var(--tok-plain,     #d4d4d8)",
};

function tokenizeLine(line, language) {
  const lang = (language || "js")
    .toLowerCase()
    .replace(/javascript/, "js")
    .replace(/typescript/, "ts")
    .replace(/python/, "py");

  const kw     = KW[lang] || KW.js;
  const tokens = [];
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    if (
      (ch === "/" && line[i + 1] === "/") ||
      (lang === "py" && ch === "#") ||
      (lang === "css" && ch === "/" && line[i + 1] === "*")
    ) {
      tokens.push({ type: "comment", value: line.slice(i) });
      break;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\" ) { j += 2; continue; }
        if (line[j] === ch  ) { j++;     break;    }
        j++;
      }
      tokens.push({ type: "string", value: line.slice(i, j) });
      i = j;
      continue;
    }

    if (/\d/.test(ch) && (i === 0 || !/[a-zA-Z0-9_$]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[\d.xXa-fA-FoObB_]/.test(line[j])) j++;
      tokens.push({ type: "number", value: line.slice(i, j) });
      i = j;
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);
      let k = j;
      while (k < line.length && line[k] === " ") k++;
      const isCall = line[k] === "(";

      if (kw.has(word))             tokens.push({ type: "keyword",  value: word });
      else if (isCall)              tokens.push({ type: "func",     value: word });
      else if (/^[A-Z]/.test(word)) tokens.push({ type: "builtin", value: word });
      else                          tokens.push({ type: "plain",    value: word });
      i = j;
      continue;
    }

    if (/[+\-*/%=<>!&|^~?:;.,()[\]{}@]/.test(ch)) {
      tokens.push({ type: "operator", value: ch });
      i++;
      continue;
    }

    tokens.push({ type: "plain", value: ch });
    i++;
  }

  return tokens;
}

function renderHighlightedLine(line, language) {
  if (!line) return null;
  // Decode HTML entities before tokenizing to fix double-encoding (e.g. &lt; → <)
  const decoded = decodeHTMLEntities(line);
  const tokens = tokenizeLine(decoded, language);
  return tokens.map((tok, idx) => (
    <span
      key={idx}
      style={{
        color     : TOKEN_COLORS[tok.type] || TOKEN_COLORS.plain,
        fontStyle : tok.type === "comment" ? "italic"  : undefined,
        fontWeight: tok.type === "keyword" ? 600       : undefined,
      }}
    >
      {tok.value}
    </span>
  ));
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. vulnLines HELPER
// ─────────────────────────────────────────────────────────────────────────────

function buildVulnRanges(vuln) {
  const startLine = vuln.StartLine || vuln.startLine || 1;
  const endLine   = vuln.EndLine   || vuln.endLine   || startLine;

  let rawLines = [];
  if (vuln.VulnLines?.length > 0)      rawLines = vuln.VulnLines;
  else if (vuln.vulnLines?.length > 0) rawLines = vuln.vulnLines;

  if (rawLines.length > 0 && typeof rawLines[0] === "number") {
    const clamped = rawLines.filter(n => n >= startLine && n <= endLine);
    if (clamped.length > 0)
      return clamped.map(n => ({ start: n, end: n }));
  } else if (rawLines.length > 0) {
    return rawLines;
  }

  return [{ start: startLine, end: endLine }];
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function isLineHit(absLineNum, ranges) {
  return ranges.some((r) => absLineNum >= r.start && absLineNum <= r.end);
}

const ShinyThinking = () => (
  <div className="flex flex-col gap-4 py-6 px-8 rounded-3xl bg-white/[0.02] [[data-theme=light]_&]:bg-black/[0.03] border border-white/[0.05] [[data-theme=light]_&]:border-black/[0.08] backdrop-blur-sm">
    <div className="flex items-center gap-3">
      <div className="relative">
        <Loader2 size={18} className="text-purple-500 animate-spin" />
        <div className="absolute inset-0 blur-sm bg-purple-500/50 animate-pulse rounded-full" />
      </div>
      <span className="text-[10px] font-mono font-black tracking-[0.4em] text-white/80 [[data-theme=light]_&]:text-black/70 uppercase animate-pulse">
        Neural_Processing_In_Progress
      </span>
    </div>
    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-purple-500/20 to-transparent" />
    <div className="flex gap-2">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
          className="h-1 w-8 rounded-full bg-purple-500/30"
        />
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// ENHANCED CODE BLOCK
// ─────────────────────────────────────────────────────────────────────────────

const EnhancedCodeBlock = ({ code, language, highlightLine = null, isVulnerability = false }) => {
  const [copied,      setCopied]      = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isExpanded,  setIsExpanded]  = useState(false);

  // Decode entities once at the top so all rendering is clean
  const cleanCode = decodeHTMLEntities(code?.trim() || "");
  const lines     = cleanCode.split("\n");

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] pointer-events-auto"
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div className={`relative group rounded-2xl border bg-[#080808] [[data-theme=light]_&]:bg-[#f4f4f8] overflow-hidden my-4 shadow-2xl [[data-theme=light]_&]:shadow-[0_4px_24px_rgba(0,0,0,0.07)] transition-all duration-300 ${
        isExpanded
          ? "fixed top-[10vh] left-[10vw] w-[80vw] h-[80vh] z-[9999] flex flex-col m-0 border-purple-500/30"
          : "border-white/10 [[data-theme=light]_&]:border-black/[0.1]"
      }`}>
        {/* Header bar */}
        <div className="flex items-center justify-between px-5 py-3 bg-white/[0.03] [[data-theme=light]_&]:bg-black/[0.04] border-b border-white/5 [[data-theme=light]_&]:border-b-black/[0.08]">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
            </div>
            <span className="text-[9px] font-mono text-zinc-500 [[data-theme=light]_&]:text-zinc-600 uppercase tracking-[0.2em] ml-2">
              {language || "source_link"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/10 rounded-lg transition-all text-zinc-500 [[data-theme=light]_&]:text-zinc-600 hover:text-white [[data-theme=light]_&]:hover:text-black"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/10 rounded-lg transition-all text-zinc-500 [[data-theme=light]_&]:text-zinc-600 hover:text-white [[data-theme=light]_&]:hover:text-black"
            >
              {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/10 rounded-lg transition-all text-zinc-500 [[data-theme=light]_&]:text-zinc-600"
            >
              {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        <div className={`overflow-x-auto custom-scrollbar transition-all duration-500 ease-in-out ${
          isExpanded
            ? "flex-1 max-h-none overflow-y-auto"
            : isCollapsed ? "max-h-0" : "max-h-[500px]"
        }`}>
          <table className="w-full border-collapse">
            <tbody className="font-mono text-[12px] leading-relaxed">
              {lines.map((line, idx) => {
                const lineNum    = idx + 1;
                const isAffected = highlightLine === lineNum;
                return (
                  <tr
                    key={idx}
                    className={
                      isAffected
                        ? isVulnerability ? "bg-red-500/15" : "bg-emerald-500/15"
                        : "hover:bg-white/[0.02] [[data-theme=light]_&]:hover:bg-black/[0.03]"
                    }
                  >
                    <td className="w-12 text-right pr-4 py-1 text-zinc-600 [[data-theme=light]_&]:text-zinc-500 select-none border-r border-white/5 [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.01] [[data-theme=light]_&]:bg-black/[0.02] tabular-nums">
                      {lineNum}
                    </td>
                    <td className="pl-5 py-1 whitespace-pre text-zinc-300 [[data-theme=light]_&]:text-zinc-900 relative">
                      {isAffected && (
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                          isVulnerability
                            ? "bg-red-500 shadow-[0_0_10px_#ef4444]"
                            : "bg-emerald-500 shadow-[0_0_10px_#10b981]"
                        }`} />
                      )}
                      {renderHighlightedLine(line, language) ?? " "}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NEURAL CODE INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────

const NeuralCodeIntelligence = ({ vuln, language }) => {
  const [view,       setView]       = useState("compare");
  const [copied,     setCopied]     = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Detect language from the code snippet itself if parent didn't pass a useful one
  const detectedLocalLang = useMemo(() => {
    const code = vuln.CodeSnippet || vuln.codeSnippet || "";
    if (!language || language === "source_link") {
      if (/^\s*<(!DOCTYPE|html|div|span|script|style)/i.test(code)) return "html";
      if (/^\s*(import|from|def|class|if __name__)\s+/m.test(code))  return "py";
      if (/^\s*(#include|int\s+main|using\s+namespace)/m.test(code)) return "cpp";
      if (/interface\s+\w+|:\s*(string|number|boolean|void)\b/.test(code)) return "ts";
      if (/^\s*(const|let|var|function|import|export|=>)/m.test(code)) return "js";
      return "js";
    }
    return language;
  }, [vuln, language]);

  const vulnRanges = buildVulnRanges(vuln);

  const startLine  = vuln.StartLine || vuln.startLine || 1;
  const endLine    = vuln.EndLine   || vuln.endLine   || startLine;
  const confidence = vuln.Confidence ?? vuln.confidence ?? 0;
  const vulnName   = vuln.VulnName  || vuln.vulnerability_name || "Unknown";
  const codeSnippet   = decodeHTMLEntities(vuln.CodeSnippet   || vuln.codeSnippet   || "");
  const repairedCode  = decodeHTMLEntities(vuln.Repair?.RepairedCode || vuln.repairedCode || "");
  const explanation   = vuln.Repair?.Explanation  || vuln.explanation  || "";
  const elapsedSecs   = vuln.Repair?.ElapsedSecs  || vuln.elapsedSecs  || 0;
  const modelUsed     = vuln.Repair?.ModelUsed     || vuln.modelUsed    || "None";
  const Comment       = vuln.Repair?.Comment       || vuln.comment || "";

  const severity =
    confidence >= 0.85 ? "High" :
    confidence >= 0.70 ? "Medium" : "Low";

  const handleCopy = (txt) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const CodePanel = ({ code, type }) => {
    const lines        = code?.trim().split("\n") || [];
    const isVulnerable = type === "vulnerable";
    const chunkStart   = startLine;

    return (
      <div className={`flex-1 min-w-[400px] flex flex-col border ${
        isVulnerable
          ? "border-red-500/10 bg-red-500/[0.01] [[data-theme=light]_&]:border-red-300/60 [[data-theme=light]_&]:bg-red-50/80"
          : "border-emerald-500/10 bg-emerald-500/[0.01] [[data-theme=light]_&]:border-emerald-300/60 [[data-theme=light]_&]:bg-emerald-50/80"
      }`}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 [[data-theme=light]_&]:border-b-black/[0.08] bg-white/[0.02] [[data-theme=light]_&]:bg-black/[0.03]">
          <div className="flex items-center gap-2">
            {isVulnerable
              ? <Bug size={12} className="text-red-500" />
              : <ShieldCheck size={12} className="text-emerald-500" />}
            <span className={`text-[9px] font-black uppercase tracking-widest ${
              isVulnerable ? "text-red-500" : "text-emerald-500"
            }`}>
              {isVulnerable ? "Vulnerability_Map" : "Neural_Remedy"}
            </span>
            <span className="text-[8px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 ml-2">
              {vulnRanges.map((r, i) => (
                <span key={i} className="mr-1">
                  {r.start === r.end ? `L${r.start}` : `L${r.start}–${r.end}`}
                </span>
              ))}
            </span>
          </div>
          <button
            onClick={() => handleCopy(code)}
            className="p-1 hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/10 rounded text-zinc-500 [[data-theme=light]_&]:text-zinc-600 hover:text-white [[data-theme=light]_&]:hover:text-black transition-colors"
          >
            {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
          </button>
        </div>

        <div className={`flex-1 overflow-auto custom-scrollbar font-mono text-[11px] leading-relaxed py-4 [[data-theme=light]_&]:bg-[#f4f4f8] ${
          isExpanded ? "max-h-none flex-1" : "max-h-[400px]"
        }`}>
          <table className="w-full border-collapse">
  <tbody>
    {lines.map((line, idx) => {
      const absLine = chunkStart + idx;
      const isHit = isLineHit(absLine, vulnRanges);
      const showHighlight = isHit && isVulnerable;

      return (
        <tr
          key={idx}
          style={showHighlight ? {
            background: "linear-gradient(90deg, rgba(239,68,68,0.18) 0%, rgba(239,68,68,0.06) 60%, transparent 100%)",
            boxShadow: "inset 0 0 20px rgba(239,68,68,0.08)",
          } : undefined}
          className={!showHighlight ? "hover:bg-white/[0.01] [[data-theme=light]_&]:hover:bg-black/[0.02]" : ""}
        >
          <td className={`w-10 text-right pr-4 select-none border-r tabular-nums py-[3px] ${
            showHighlight
              ? "text-red-400 border-red-500/30 bg-red-500/10"
              : "text-zinc-600 [[data-theme=light]_&]:text-zinc-500 border-white/5 [[data-theme=light]_&]:border-black/[0.08] opacity-50 [[data-theme=light]_&]:opacity-80"
          }`}>
            {absLine}
          </td>

          <td className="pl-4 whitespace-pre text-zinc-300 [[data-theme=light]_&]:text-zinc-900 relative py-[3px]">
            {showHighlight && (
              <div
                className="absolute left-0 top-0 bottom-0 w-[3px] z-10 bg-red-500"
                style={{
                  boxShadow: "0 0 8px #ef4444, 0 0 20px #ef4444, 0 0 40px rgba(239,68,68,0.4)",
                }}
              />
            )}
            <span style={showHighlight ? {
              textShadow: "0 0 12px rgba(239,68,68,0.6)",
              fontWeight: 500,
            } : undefined}>
              {renderHighlightedLine(line, detectedLocalLang) ?? " "}
            </span>
          </td>
        </tr>
      );
    })}
  </tbody>
</table>
        </div>
      </div>
    );
  };

  return (
    <>
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] pointer-events-auto"
          onClick={() => setIsExpanded(false)}
        />
      )}
      <div className={`rounded-3xl border bg-[#050505] [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-[0_8px_40px_rgba(0,0,0,0.08)] overflow-hidden shadow-2xl my-8 pointer-events-auto transition-all duration-300 hover:-translate-y-2 hover:scale-[1.01] hover:shadow-[0_20px_50px_rgba(147,51,234,0.18)] ${
        isExpanded
          ? "fixed top-[10vh] left-[10vw] w-[80vw] h-[80vh] z-[9999] flex flex-col m-0 border-purple-500/30"
          : "w-full border-white/10 [[data-theme=light]_&]:border-black/[0.08]"
      }`}>
        {/* Card header */}
        <div className="px-8 py-4 bg-white/[0.02] [[data-theme=light]_&]:bg-[#f7f7fb] border-b border-white/5 [[data-theme=light]_&]:border-b-black/[0.08] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Fingerprint size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white [[data-theme=light]_&]:text-zinc-900 font-space tracking-tight uppercase leading-none">
                {vulnName}
              </h3>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={`text-[9px] font-mono font-black px-2 py-0.5 rounded border ${
                  severity === "High"
                    ? "text-red-400 border-red-500/30 bg-red-500/10 [[data-theme=light]_&]:border-red-300 [[data-theme=light]_&]:bg-red-50 [[data-theme=light]_&]:text-red-700"
                    : severity === "Medium"
                    ? "text-yellow-400 border-yellow-500/30 bg-yellow-500/10 [[data-theme=light]_&]:border-yellow-300 [[data-theme=light]_&]:bg-yellow-50 [[data-theme=light]_&]:text-yellow-700"
                    : "text-blue-400 border-blue-500/30 bg-blue-500/10 [[data-theme=light]_&]:border-blue-300 [[data-theme=light]_&]:bg-blue-50 [[data-theme=light]_&]:text-blue-700"
                } uppercase`}>
                  Severity: {severity}
                </span>

                <span className="text-[9px] font-mono text-green-500 [[data-theme=light]_&]:text-green-700 uppercase tracking-widest border border-green-500/30 [[data-theme=light]_&]:border-green-300 px-2 py-0.5 rounded bg-green-500/[0.07] [[data-theme=light]_&]:bg-green-50">
                  Lines: {startLine}–{endLine}
                </span>

                {vulnRanges.length > 0 && (
                  <span className="flex items-center gap-1 flex-wrap">
                    {vulnRanges.map((r, i) => (
                      <span
                        key={i}
                        className="text-[8px] font-mono text-violet-400 [[data-theme=light]_&]:text-violet-700 border border-violet-500/20 [[data-theme=light]_&]:border-violet-300 px-1.5 py-0.5 rounded bg-violet-500/5 [[data-theme=light]_&]:bg-violet-50"
                      >
                        {r.start === r.end ? `#${r.start}` : `#${r.start}–${r.end}`}
                      </span>
                    ))}
                  </span>
                )}

                <span className="text-[9px] font-mono text-amber-500 [[data-theme=light]_&]:text-amber-800 font-bold uppercase border border-amber-500/20 [[data-theme=light]_&]:border-amber-300 px-2 py-0.5 rounded bg-amber-500/5 [[data-theme=light]_&]:bg-amber-50">
                  Confidence: {(confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex bg-white/5 [[data-theme=light]_&]:bg-black/5 p-1 rounded-xl border border-white/5 [[data-theme=light]_&]:border-black/5 items-center gap-2">
            <button
              onClick={() => setView("compare")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                view === "compare"
                  ? "bg-white text-black [[data-theme=light]_&]:bg-black [[data-theme=light]_&]:text-white"
                  : "text-zinc-500 hover:text-white [[data-theme=light]_&]:text-zinc-400 [[data-theme=light]_&]:hover:text-black"
              }`}
            >
              COMPARE
            </button>
            <button
              onClick={() => setView("repaired")}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                view === "repaired"
                  ? "bg-white text-black [[data-theme=light]_&]:bg-black [[data-theme=light]_&]:text-white"
                  : "text-zinc-500 hover:text-white [[data-theme=light]_&]:text-zinc-400 [[data-theme=light]_&]:hover:text-black"
              }`}
            >
              REPAIRED_ONLY
            </button>
            <div className="w-[1px] h-4 bg-white/10 [[data-theme=light]_&]:bg-black/10 mx-1" />
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/5 [[data-theme=light]_&]:text-zinc-400 [[data-theme=light]_&]:hover:text-black [[data-theme=light]_&]:hover:bg-black/5 transition-all"
              title={isExpanded ? "Exit Picture-in-Picture" : "Scale to 80% screen"}
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>

        {/* Code panels */}
        <div className={`flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/5 [[data-theme=light]_&]:divide-black/[0.08] bg-black [[data-theme=light]_&]:bg-[#f4f4f8] ${
          isExpanded ? "flex-1 overflow-hidden" : ""
        }`}>
          {view === "compare" && <CodePanel code={codeSnippet}  type="vulnerable" />}
          <CodePanel code={repairedCode} type="repaired" />
        </div>

        {/* Remediation footer */}
        <div className="p-6 bg-white/[0.01] [[data-theme=light]_&]:bg-[#fafafa] border-t border-white/5 [[data-theme=light]_&]:border-t-black/[0.08]">
          <div className="flex items-start gap-4">
            <div className="mt-1 text-purple-500">
              <Zap size={16} />
            </div>
            <div>
              <span className="text-[10px] font-black text-white/40 [[data-theme=light]_&]:text-black/60 uppercase tracking-[0.2em] block mb-1">
                Remediation_Strategy:
              </span>
              <p className="text-xs text-zinc-400 [[data-theme=light]_&]:text-zinc-700 leading-relaxed italic">
                {Comment}
                <br />
                <br />
                <span className="text-[10px] font-black text-white/40 [[data-theme=light]_&]:text-black/60 uppercase tracking-[0.2em] block mb-1">
                  To Fix it :
                </span>
                {explanation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STAGED CODE PREVIEW (shared between intro + chat input)
// ─────────────────────────────────────────────────────────────────────────────

const StagedCodePreview = ({ stagedCode, detectedLang, onEdit, onClear }) => (
  <motion.div
    initial={{ opacity: 0, y: 10, scale: 0.97 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="absolute bottom-[calc(100%+16px)] left-0 right-0
               bg-[#0A0A0A]/95 [[data-theme=light]_&]:bg-white
               border border-purple-500/30 [[data-theme=light]_&]:border-purple-300/60
               rounded-2xl overflow-hidden backdrop-blur-2xl shadow-2xl
               [[data-theme=light]_&]:shadow-[0_-8px_40px_rgba(0,0,0,0.1)]"
  >
    {/* Header */}
    <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.02] [[data-theme=light]_&]:bg-black/[0.03]">
      <div className="flex items-center gap-3">
        <Code2 size={14} className="text-purple-500" />
        <span className="text-[9px] font-mono font-bold text-white/40 [[data-theme=light]_&]:text-black/60 uppercase tracking-[0.3em]">
          Staged_Code
        </span>
        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 [[data-theme=light]_&]:text-purple-700 text-[9px] font-bold uppercase tracking-widest">
          {detectedLang}
        </span>
        <span className="text-[9px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 uppercase tracking-widest">
          {stagedCode.split("\n").length} lines
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onEdit}
          className="text-[9px] font-mono text-zinc-500 hover:text-white [[data-theme=light]_&]:hover:text-black uppercase tracking-widest px-2 py-1 rounded hover:bg-white/5 [[data-theme=light]_&]:hover:bg-black/5 transition-all"
        >
          Edit
        </button>
        <button
          onClick={onClear}
          className="p-1 hover:bg-white/10 [[data-theme=light]_&]:hover:bg-black/10 rounded text-zinc-500 hover:text-red-400 transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>

    {/* Line-numbered, syntax-highlighted preview */}
    <div className="max-h-52 overflow-y-auto custom-scrollbar py-3">
      <table className="w-full border-collapse font-mono text-[11px] leading-relaxed">
        <tbody>
          {stagedCode.split("\n").map((line, idx) => (
            <tr key={idx} className="hover:bg-white/[0.02] [[data-theme=light]_&]:hover:bg-black/[0.02]">
              <td className="w-10 text-right pr-4 text-zinc-700 [[data-theme=light]_&]:text-zinc-400 select-none border-r border-white/5 [[data-theme=light]_&]:border-black/[0.08] tabular-nums py-[2px]">
                {idx + 1}
              </td>
              <td className="pl-4 whitespace-pre text-zinc-300 [[data-theme=light]_&]:text-zinc-800 py-[2px]">
                {renderHighlightedLine(line, detectedLang) ?? " "}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Footer */}
    <div className="px-5 py-2.5 border-t border-white/5 [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.01] [[data-theme=light]_&]:bg-black/[0.02] flex items-center justify-between">
      <span className="text-[9px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 uppercase tracking-widest">
        Ready to scan — press Execute or Enter
      </span>
      <div className="flex gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500/50 animate-pulse [animation-delay:0.2s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-purple-500/20 animate-pulse [animation-delay:0.4s]" />
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function SplineAgentPage() {
  const { user, logout } = useAuth();
  const [started,       setStarted]       = useState(false);
  const [messages,      setMessages]      = useState([]);
  const [input,         setInput]         = useState("");
  const [sidebarOpen,   setSidebarOpen]   = useState(false);
  const [chatsHistory,  setChatsHistory]  = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isProcessing,  setIsProcessing]  = useState(false);
  const [editingChatId, setEditingChatId] = useState(null);
  const [renameValue,   setRenameValue]   = useState("");
  const [isScanning,    setIsScanning]    = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const [stagedCode,   setStagedCode]   = useState(null);
  const [detectedLang, setDetectedLang] = useState("");

  const messagesEndRef   = useRef(null);
  const fileInputRef     = useRef(null);
  const chatContainerRef = useRef(null);
  const selectRequestRef = useRef(0);
  const cancelRenameRef  = useRef(false);
  const textareaRef      = useRef(null);
  const textareaIntroRef = useRef(null);

  // Auto-resize any textarea to fit its content (max 160px ≈ 6 lines)
  const autoResize = (el) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  useEffect(() => { fetchHistory(); }, []);

  // ── DETECT BROWSER ZOOM CHANGES AND UPDATE SPLINE ──────────────────────────
  useEffect(() => {
    let mqList = null;

    const triggerResize = () => {
      window.dispatchEvent(new Event("resize"));
    };

    const handleDPRChange = () => {
      triggerResize();
      listenToDPR();
    };

    const listenToDPR = () => {
      if (mqList) {
        mqList.removeEventListener("change", handleDPRChange);
      }
      mqList = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      mqList.addEventListener("change", handleDPRChange);
    };

    listenToDPR();
    window.visualViewport?.addEventListener("resize", triggerResize);

    return () => {
      if (mqList) {
        mqList.removeEventListener("change", handleDPRChange);
      }
      window.visualViewport?.removeEventListener("resize", triggerResize);
    };
  }, []);

  const fetchHistory = async () => {
    try {
      const history = await getAllChats();
      setChatsHistory(Array.isArray(history) ? history : []);
    } catch {
      setChatsHistory([]);
    }
  };

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, isScanning]);

  const detectLanguage = (code) => {
    if (/^\s*<(!DOCTYPE|html|div|span|script|style)/i.test(code))       return "html";
    if (/^\s*(import|from|def|class|if __name__)\s+/m.test(code))        return "py";
    if (/^\s*(#include|int\s+main|using\s+namespace|std::)/m.test(code)) return "cpp";
    if (/^\s*(<\?php|namespace|public\s+function)/i.test(code))          return "php";
    if (/^\s*(const|let|var|function|import|export|interface|type)\s+/m.test(code) || code.includes("=>")) return "js";
    return "code";
  };

  const handleInputChange = (val) => {
    setInput(val);
    const isLikelyCode =
      val.split("\n").length > 2 ||
      /[{}[\];]/.test(val)       ||
      /^\s*(def|function|class|import|#include)/m.test(val);
    if (isLikelyCode && val.trim().length > 10) {
      setStagedCode(val);
      setDetectedLang(detectLanguage(val));
    } else {
      setStagedCode(null);
    }
  };

  const downloadFile = (base64Data, fileName, type = "application/pdf") => {
    if (!base64Data) return;
    try {
      const link    = document.createElement("a");
      link.href     = `data:${type};base64,${base64Data}`;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) { console.error("Download error", error); }
  };

  const generateChatPDF = async () => {
    if (isExportingPDF || messages.length === 0) return;
    setIsExportingPDF(true);

    try {
      const { jsPDF } = await import("jspdf");

      let externalReshaper = null;
      try {
        const reshaperModule = await import(
          /* @vite-ignore */ "https://esm.sh/arabic-persian-reshaper"
        );
        externalReshaper = reshaperModule.default || reshaperModule;
      } catch (e) {
        console.warn("External Arabic reshaper load failed. Using high-fidelity local fallback instead.", e);
      }

      const reshapeArabicLocal = (text) => {
        if (!text) return "";

        const arabicCharsMap = {
          '\u0621': ['\uFE80', '\uFE80', '\uFE80', '\uFE80'],
          '\u0622': ['\uFE81', '\uFE82', '\uFE82', '\uFE81'],
          '\u0623': ['\uFE83', '\uFE84', '\uFE84', '\uFE83'],
          '\u0624': ['\uFE85', '\uFE86', '\uFE86', '\uFE85'],
          '\u0625': ['\uFE87', '\uFE88', '\uFE84', '\uFE87'],
          '\u0626': ['\uFE89', '\uFE8A', '\uFE8C', '\uFE8B'],
          '\u0627': ['\uFE8D', '\uFE8E', '\uFE8E', '\uFE8D'],
          '\u0628': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'],
          '\u0629': ['\uFE93', '\uFE94', '\uFE94', '\uFE93'],
          '\u062A': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
          '\u062B': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'],
          '\u062C': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
          '\u062D': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'],
          '\u062E': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
          '\u062F': ['\uFEA9', '\uFEAA', '\uFEAA', '\uFEA9'],
          '\u0630': ['\uFEAB', '\uFEAC', '\uFEAC', '\uFEAB'],
          '\u0631': ['\uFEAD', '\uFEAE', '\uFEAE', '\uFEAD'],
          '\u0632': ['\uFEAF', '\uFEB0', '\uFEB0', '\uFEAF'],
          '\u0633': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'],
          '\u0634': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
          '\u0635': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'],
          '\u0636': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
          '\u0637': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'],
          '\u0638': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFEC7'],
          '\u0639': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'],
          '\u063A': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
          '\u0641': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'],
          '\u0642': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
          '\u0643': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'],
          '\u0644': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
          '\u0645': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'],
          '\u0646': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
          '\u0647': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'],
          '\u0648': ['\uFEED', '\uFEEE', '\uFEEE', '\uFEED'],
          '\u0649': ['\uFEEF', '\uFEF0', '\uFEF0', '\uFEEF'],
          '\u064A': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'],
        };

        const rightLink = ['\u0622', '\u0623', '\u0624', '\u0625', '\u0627', '\u062F', '\u0630', '\u0631', '\u0632', '\u0648', '\u0649'];
        const dualLink = ['\u0628', '\u062A', '\u062B', '\u062C', '\u062D', '\u062E', '\u0633', '\u0634', '\u0635', '\u0636', '\u0637', '\u0638', '\u0639', '\u063A', '\u0641', '\u0642', '\u0643', '\u0644', '\u0645', '\u0646', '\u0647', '\u064A', '\u0626'];

        let words = text.split(" ");
        let result = [];

        for (let w = 0; w < words.length; w++) {
          let word = words[w];
          let shapedWord = "";
          for (let i = 0; i < word.length; i++) {
            let char = word[i];
            if (!arabicCharsMap[char]) {
              shapedWord += char;
              continue;
            }
            let prev = word[i - 1];
            let next = word[i + 1];

            let linkPrev = prev && (dualLink.includes(prev) || rightLink.includes(prev));
            let linkNext = next && (dualLink.includes(next));

            if (linkPrev && linkNext) {
              shapedWord += arabicCharsMap[char][2];
            } else if (linkPrev) {
              shapedWord += arabicCharsMap[char][1];
            } else if (linkNext) {
              shapedWord += arabicCharsMap[char][3];
            } else {
              shapedWord += arabicCharsMap[char][0];
            }
          }
          result.push(shapedWord);
        }
        return result.join(" ");
      };

      const shapeText = (txt) => {
        if (!txt) return "";
        if (externalReshaper && typeof externalReshaper.reshape === "function") {
          return externalReshaper.reshape(txt);
        }
        return reshapeArabicLocal(txt);
      };

      const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const PW  = 210;
      const PH  = 297;
      const ML  = 15;
      const MR  = 15;
      const CW  = PW - ML - MR;
      let   y   = ML;

      try {
        const fontUrl = "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf";
        const response = await fetch(fontUrl);
        if (!response.ok) throw new Error("Font fetch failed");
        const arrayBuffer = await response.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ""
          )
        );
        doc.addFileToVFS("Amiri-Regular.ttf", base64);
        doc.addFont("Amiri-Regular.ttf", "Amiri", "normal");
      } catch (fontErr) {
        console.error("Failed to load Amiri font dynamically:", fontErr);
      }

      const C = {
        pageBg    : [8,   8,  10],
        cardDark  : [20,  20, 24],
        cardBorder: [45,  45, 50],
        gutter    : [14,  14, 18],
        purple    : [139, 92, 246],
        purpleLo  : [76,  29,149],
        white     : [255,255,255],
        z200      : [228,228,231],
        z300      : [212,212,216],
        z400      : [161,161,170],
        z500      : [113,113,122],
        z600      : [82, 82, 91 ],
        z700      : [63, 63, 70 ],
        z800      : [39, 39, 42 ],
        z850      : [28, 28, 32 ],
        z900      : [18, 18, 22 ],
        red       : [239, 68, 68],
        redBg     : [40,  8,  8 ],
        redStripe : [80, 16, 16 ],
        emerald   : [52, 211,153],
        emeraldBg : [4,  28, 18 ],
        yellow    : [251,191, 36],
        blue      : [96, 165,250],
      };

      const fc  = (rgb) => doc.setFillColor(...rgb);
      const sc  = (rgb) => doc.setDrawColor(...rgb);
      const tc  = (rgb) => doc.setTextColor(...rgb);
      const lw  = (w)   => doc.setLineWidth(w);
      const H   = (sz)  => { doc.setFont("helvetica","bold");   doc.setFontSize(sz); };
      const N   = (sz)  => { doc.setFont("helvetica","normal"); doc.setFontSize(sz); };
      const I   = (sz)  => { doc.setFont("helvetica","italic"); doc.setFontSize(sz); };
      const M   = (sz)  => { doc.setFont("courier",  "normal"); doc.setFontSize(sz); };
      const MB  = (sz)  => { doc.setFont("courier",  "bold");   doc.setFontSize(sz); };

      const isArabic = (text) => /[\u0600-\u06FF]/.test(String(text || ""));

      const writeText = (txt, x, y, options = {}) => {
        if (!txt) return;
        const isAr = isArabic(txt);

        const fonts = doc.getFontList();
        const hasAmiri = fonts && fonts["Amiri"];

        if (isAr && hasAmiri) {
          doc.setFont("Amiri", "normal");
          const shaped = shapeText(txt);
          const targetX = (x === ML) ? (PW - MR) : x;
          doc.text(shaped, targetX, y, { ...options, isRTL: true, align: "right" });
        } else {
          doc.setFont("helvetica", options.fontStyle || "normal");
          doc.text(txt, x, y, options);
        }
      };

      const writeLines = (lines, x, y, lh, options = {}) => {
        if (!lines || lines.length === 0) return;
        lines.forEach((line, i) => {
          writeText(line, x, y + (i * lh), options);
        });
      };

      const wrap = (txt, maxW, sz, bold = false) => {
        const isAr = isArabic(txt);
        const fonts = doc.getFontList();
        const hasAmiri = fonts && fonts["Amiri"];

        if (isAr && hasAmiri) {
          doc.setFont("Amiri", "normal");
        } else {
          doc.setFont("helvetica", bold ? "bold" : "normal");
        }
        doc.setFontSize(sz);

        const lines = doc.splitTextToSize(String(txt ?? ""), maxW);
        if (isAr) {
          return lines.map(line => shapeText(line));
        }
        return lines;
      };

      const wrapMono = (txt, maxW, sz) => {
        doc.setFont("courier","normal"); doc.setFontSize(sz);
        return doc.splitTextToSize(String(txt ?? ""), maxW);
      };

      const bg = () => { fc(C.pageBg); doc.rect(0,0,PW,PH,"F"); };

      const footer = (p, total) => {
        fc(C.z850); doc.rect(0, PH-9, PW, 9, "F");
        N(6); tc(C.z600);
        doc.text("VulnSneak-AI \xB7 Confidential Security Report", ML, PH-3);
        doc.text(`${p} / ${total}`, PW-MR, PH-3, { align:"right" });
      };

      const br = (need = 20) => {
        if (y + need > PH - 12) { doc.addPage(); bg(); y = ML; return true; }
        return false;
      };

      const divider = (opacity = 0.3) => {
        sc(C.z700); lw(0.12);
        doc.line(ML, y, PW-MR, y);
        y += 5;
      };

      const drawCodeBlock = (codeText, blockType, vulnRanges, startLine, label) => {
        if (!codeText?.trim()) return;

        // Decode entities so code renders correctly in PDF too
        const decodedCode = decodeHTMLEntities(codeText);

        const isVuln  = blockType === "vulnerable";
        const rawLines = decodedCode.trim().split("\n");

        const FS      = 7.2;
        const LH      = 4.8;
        const GW      = 11;
        const PAD_L   = 3;
        const PAD_V   = 3;
        const HDR_H   = 8;
        const STRIPE  = 2;
        const INDENT  = 2;

        const bodyH   = rawLines.length * LH + PAD_V * 2;
        const totalH  = HDR_H + bodyH;

        br(totalH + 8);

        const accent  = isVuln ? C.red     : C.emerald;
        const bodyBg  = isVuln ? C.redBg   : C.emeraldBg;
        const hitBg   = isVuln ? C.redStripe : [8,50,30];

        fc(bodyBg);
        sc(accent.map(v => Math.round(v * 0.38)));
        lw(0.3);
        doc.roundedRect(ML, y, CW, totalH, 1.5, 1.5, "FD");

        fc(accent.map(v => Math.round(v * 0.22)));
        doc.rect(ML, y, CW, HDR_H, "F");
        fc(bodyBg); doc.rect(ML, y + HDR_H - 1, CW, 1, "F");

        fc(accent); doc.rect(ML, y, 2.5, HDR_H, "F");

        MB(6.8); tc(accent);
        doc.text(
          `  ${label}`,
          ML + 5, y + HDR_H - 2.2
        );

        N(6); tc(accent.map(v => Math.round(v * 0.75)));
        const countTxt = `${rawLines.length} lines`;
        doc.text(countTxt, ML + CW - MR*0.4, y + HDR_H - 2.2, { align:"right" });

        y += HDR_H;

        sc(accent.map(v => Math.round(v * 0.3))); lw(0.15);
        doc.line(ML, y, ML + CW, y);
        y += PAD_V;

        rawLines.forEach((rawLine, idx) => {
          const absLine = startLine + idx;
          const isHit   = isVuln
            ? (vulnRanges || []).some(r => absLine >= r.start && absLine <= r.end)
            : false;

          const rowY = y + idx * LH;
          const txtY = rowY + LH - 1.3;

          if (isHit) {
            fc(hitBg);
            doc.rect(ML, rowY, CW, LH, "F");
            fc(accent);
            doc.rect(ML, rowY, STRIPE, LH, "F");
          }

          fc(isHit ? accent.map(v => Math.round(v * 0.28)) : C.z900);
          doc.rect(ML, rowY, GW, LH, "F");

          M(FS - 0.8);
          tc(isHit ? accent : C.z600);
          doc.text(
            String(absLine).padStart(3),
            ML + GW - 1.5, txtY, { align:"right" }
          );

          sc(isHit ? accent.map(v => Math.round(v * 0.4)) : C.z800);
          lw(0.12);
          doc.line(ML + GW, rowY, ML + GW, rowY + LH);

          tc(isHit ? (isVuln ? [255,200,200] : [180,255,220]) : C.z300);

          const lineIsAr = isArabic(rawLine);
          const maxCodeW = CW - GW - PAD_L - INDENT - 2;
          let displayLine = rawLine;

          while (displayLine.length > 0 && doc.getTextWidth(displayLine) > maxCodeW) {
            displayLine = displayLine.slice(0, -4) + "...";
          }

          if (lineIsAr) {
            doc.setFont("Amiri", "normal");
            doc.setFontSize(FS + 1);
            const shaped = shapeText(displayLine);
            doc.text(shaped, ML + GW + PAD_L + INDENT, txtY, { isRTL: true, align: "left" });
          } else {
            doc.setFont("courier", "normal");
            doc.setFontSize(FS);
            doc.text(displayLine || " ", ML + GW + PAD_L + INDENT, txtY);
          }
        });

        y += rawLines.length * LH + PAD_V + 2;
      };

      // ── COVER PAGE ──────────────────────────────────────────────────────────
      bg();
      fc(C.purple); doc.rect(0, 0, PW, 3, "F");

      y = 40;
      doc.setFontSize(36); doc.setFont("helvetica","bold");
      tc(C.z700); doc.text("VULN", ML, y);
      const _w1 = doc.getTextWidth("VULN");
      tc(C.white); doc.text("SNEAK", ML + _w1, y);
      const _w2 = doc.getTextWidth("SNEAK");
      tc(C.purple); doc.text(".", ML + _w1 + _w2, y);

      y += 5; N(7); tc(C.z600);
      doc.text("AUTONOMOUS SECURITY INTELLIGENCE REPORT", ML, y);

      y += 10; sc(C.purpleLo); lw(0.3);
      doc.line(ML, y, PW-MR, y);

      y += 9;
      const chatName = chatsHistory.find(c=>(c.chatId||c.id)===currentChatId)?.chatName || "Untitled_Chat";
      const titleLns = wrap(chatName, CW, 16, true);
      H(16); tc(C.white);
      writeLines(titleLns, ML, y, 7);
      y += titleLns.length * 7 + 5;

      N(8); tc(C.z400);
      doc.text(`Generated : ${new Date().toUTCString()}`, ML, y); y += 5;
      doc.text(`Messages  : ${messages.length}`, ML, y); y += 5;

      const totalVulns = messages.reduce((a,m)=>a+(m.vulnDtos?.length||0),0);
      doc.text(`Vulnerabilities detected : ${totalVulns}`, ML, y); y += 5;

      if (totalVulns > 0) {
        y += 5;
        const allV  = messages.flatMap(m => m.vulnDtos || []);
        const high   = allV.filter(v=>(v.Confidence??v.confidence??0)>=0.85).length;
        const medium = allV.filter(v=>{const c=v.Confidence??v.confidence??0;return c>=0.70&&c<0.85;}).length;
        const low    = allV.length - high - medium;
        let bx = ML;
        [{l:"HIGH",n:high,col:C.red},{l:"MEDIUM",n:medium,col:C.yellow},{l:"LOW",n:low,col:C.blue}]
          .forEach(({l,n,col}) => {
            let badgeText = `${l}: ${n}`;
            fc(col);
            doc.rect(bx, y, 32, 6, "F");
            N(7); tc(C.white);
            doc.text(badgeText, bx + 16, y + 4.2, {align:"center"});
            bx += 35;
          });
        y += 8;
      }

      // ── MESSAGES ────────────────────────────────────────────────────────────
      doc.addPage(); bg(); y = ML;

      messages.forEach((msg) => {
        br(30);

        if (msg.sender === "user") {
          const lns = wrap(msg.text, CW - 20, 9);
          const bh  = lns.length * 5.2 + 10;
          br(bh + 12);

          fc(C.white);
          doc.roundedRect(ML + 20, y, CW - 20, bh, 2, 2, "F");
          H(9); tc([5,5,5]);
          writeLines(lns, ML + 26, y + 7, 5.2);
          y += bh + 3;

          N(6.5); tc(C.z600);
          doc.text(msg.isText ? "TEXT QUERY" : "FILE UPLOAD", PW-MR, y, {align:"right"});
          y += 9;

        } else {
          fc(C.purple);
          doc.roundedRect(ML, y, 32, 6, 2, 2, "F");
          H(6.2); tc(C.white);
          doc.text("VULNSNEAK-ENGINE", ML + 16, y + 4.2, {align:"center"});
          y += 9;

          const lns = wrap(msg.text, CW, 9);
          br(lns.length * 5.2 + 6);
          N(9); tc(C.z400);
          writeLines(lns, ML, y, 5.2);
          y += lns.length * 5.2 + 6;

          (msg.vulnDtos || []).forEach((vuln, vi) => {
            br(50);

            const conf   = vuln.Confidence ?? vuln.confidence ?? 0;
            const sev    = conf>=0.85 ? "HIGH" : conf>=0.70 ? "MEDIUM" : "LOW";
            const sevCol = sev==="HIGH" ? C.red : sev==="MEDIUM" ? C.yellow : C.blue;
            const name   = vuln.VulnName || vuln.vulnerability_name || "Unknown Vulnerability";
            const sLine  = vuln.StartLine || vuln.startLine || 1;
            const eLine  = vuln.EndLine   || vuln.endLine   || sLine;
            const comment= vuln.Repair?.Comment     || vuln.comment     || "";
            const explain= vuln.Repair?.Explanation || vuln.explanation || "";
            const codeSnip = decodeHTMLEntities(vuln.CodeSnippet || vuln.codeSnippet || "");
            const repaired = decodeHTMLEntities(vuln.Repair?.RepairedCode || vuln.repairedCode || "");
            const ranges   = buildVulnRanges(vuln);

            const nameLns = wrap(name,    CW - 18, 11, true);
            const commLns = comment ? wrap(comment, CW - 18, 8) : [];
            const explLns = explain ? wrap(explain, CW - 18, 8) : [];
            const mH = nameLns.length*7 + commLns.length*4.8 + explLns.length*4.8 + 42;
            br(mH + 8);

            fc(C.z850);
            sc(sevCol.map(v=>Math.round(v*0.35))); lw(0.2);
            doc.roundedRect(ML, y, CW, mH, 2, 2, "FD");
            fc(sevCol); doc.rect(ML, y, 3.5, mH, "F");

            let cx = ML + 9, cy = y + 9;

            H(11); tc(C.white);
            writeLines(nameLns, cx, cy, 7);
            cy += nameLns.length * 7 + 5;

            let bx = cx;
            [
              { t:`SEVERITY: ${sev}`,                      col: sevCol    },
              { t:`LINES: ${sLine}\u2013${eLine}`,          col: C.emerald },
              { t:`CONFIDENCE: ${(conf*100).toFixed(0)}%`, col: C.yellow  },
            ].forEach(({t,col}) => {
              H(6.5); const bw = doc.getTextWidth(t) + 9;
              fc(col.map(c=>Math.round(c*0.16)));
              doc.roundedRect(bx, cy, bw, 6, 1.5, 1.5, "F");
              tc(col); doc.text(t, bx + bw/2, cy + 4.2, {align:"center"});
              bx += bw + 5;
            });
            cy += 10;

            sc(sevCol.map(v=>Math.round(v*0.2))); lw(0.12);
            doc.line(cx, cy, ML+CW-4, cy); cy += 5;

            if (commLns.length > 0) {
              H(7); tc(C.z500); writeText("STRATEGY", cx, cy); cy += 5;
              I(8); tc(C.z400); writeLines(commLns, cx, cy, 4.8);
              cy += commLns.length * 4.8 + 3;
            }
            if (explLns.length > 0) {
              H(7); tc(C.z500); writeText("HOW TO FIX", cx, cy); cy += 5;
              N(8); tc(C.z300); writeLines(explLns, cx, cy, 4.8);
            }

            y += mH + 8;

            if (codeSnip.trim()) {
              drawCodeBlock(
                codeSnip, "vulnerable", ranges, sLine,
                `VULNERABLE SOURCE  \xB7  Lines ${sLine}\u2013${eLine}`
              );
              y += 4;
            }

            if (repaired.trim()) {
              drawCodeBlock(
                repaired, "repaired", [], sLine,
                "REPAIRED CODE  \xB7  Neural Remedy Applied"
              );
              y += 4;
            }

            sc(C.z800); lw(0.15);
            doc.line(ML+8, y, PW-MR-8, y);
            y += 7;
          });

          if (msg.fileReport) {
            br(10);
            fc([18,6,36]);
            doc.roundedRect(ML, y, CW, 7.5, 1.5, 1.5, "F");
            N(7); tc(C.purple);
            doc.text("\u2193  Neural_Intel_Export PDF available for this scan", ML+5, y+5.2);
            y += 12;
          }
        }

        divider();
      });

      const tp = doc.getNumberOfPages();
      for (let p=1; p<=tp; p++) {
        doc.setPage(p);
        footer(p, tp);
      }

      const slug = chatName.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,36);
      doc.save(`VulnSneak_${slug}_${Date.now()}.pdf`);

    } catch(err) {
      console.error("PDF export failed:", err);
      alert("PDF export failed.");
    } finally {
      setIsExportingPDF(false);
    }
  };

  const deriveChatTitle = (data, fallback) => {
    const vulnName =
      data?.vulnDtos?.[0]?.VulnName ||
      data?.vulnDtos?.[0]?.vulnerability_name;

    const responseText = data?.response || data?.message || "";
    const topicMatch = responseText.match(
      /(?:vulnerability|issue|bug|security|error|problem|detect)[:\s]+([^\n.]{5,60})/i
    );
    const extractedTopic = topicMatch?.[1]?.trim();

    const firstSentence = responseText
      .split(/[.\n]/)[0]
      ?.replace(/^(analysis|scan|result|neural engine)[:\s]*/i, "")
      ?.trim();

    const raw = vulnName || extractedTopic || firstSentence || fallback || "Untitled_Chat";
    const clean = String(raw).replace(/\s+/g, " ").trim();
    return clean.length > 48 ? `${clean.slice(0, 48).trim()}…` : clean;
  };

  const applyChatRename = async (chatId, title) => {
    const trimmed = (title || "").trim();
    if (!trimmed) return;
    try {
      await renameChat(chatId, trimmed);
      setChatsHistory((prev) =>
        prev.map((chat) =>
          (chat.chatId || chat.id) === chatId ? { ...chat, chatName: trimmed } : chat
        )
      );
    } catch (err) { console.error("Rename failed", err); }
  };

  const handleRenameSubmit = async (chatId) => {
    const trimmed = renameValue.trim();
    setEditingChatId(null);
    setRenameValue("");
    if (!trimmed) return;
    await applyChatRename(chatId, trimmed);
  };

  const handleSelectOldChat = async (chatId) => {
    if (editingChatId) return;
    const requestId = ++selectRequestRef.current;
    setIsProcessing(true);
    try {
      const historyData = await getChatMessages(chatId);

      if (requestId !== selectRequestRef.current) return;

      const formattedMessages = [];
      if (Array.isArray(historyData)) {
        historyData.forEach((session) => {
          formattedMessages.push({
            sender   : "user",
            text     : `NODE_INGESTION: ${session.fileName || "FILE_X"}`,
            createdAt: session.createdAt,
          });
          formattedMessages.push({
            sender          : "bot",
            text            : session.status === "Safe"
              ? `Analysis of  "${session.fileName}" Synchronized. All protocols safe.`
              : `Scan Result: ${session.status}`,
            label           : session.status || "Safe",
            vulnDtos        : session.vulnDtos || [],
            fileReport      : session.fileReport,
            repairedFile    : session.repairedFile,
            repairedFileName: session.repairedFileName,
            fileName        : session.fileName,
            createdAt       : session.createdAt,
          });
        });
      }
      setMessages(formattedMessages);
      setCurrentChatId(chatId);
      setStarted(true);
      setSidebarOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      if (requestId === selectRequestRef.current) setIsProcessing(false);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!window.confirm("Permanent Purge? This will erase all intelligence records.")) return;
    try {
      await deleteChat(chatId);
      setChatsHistory((prev) => prev.filter((c) => (c.chatId || c.id) !== chatId));
      if (currentChatId === chatId) handleNewChat();
    } catch (err) { console.error(err); }
  };

  const handleNewChat = () => {
    setStarted(false);
    setMessages([]);
    setCurrentChatId(null);
    setSidebarOpen(false);
  };

  const ensureChat = async (name = "Chat_" + Date.now()) => {
    if (currentChatId) return { id: currentChatId, isNew: false };
    const newChat = await createChat(name);
    const id      = newChat.chatId || newChat.id;
    setCurrentChatId(id);
    setChatsHistory((prev) => [
      { chatId: id, id, chatName: name, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    return { id, isNew: true };
  };

  const sendTextMessage = async (text) => {
    setIsScanning(true);
    if (!started) setStarted(true);
    setMessages((prev) => [...prev, { sender: "user", text, isText: true }]);
    try {
      const { id: activeChatId, isNew } = await ensureChat(text.slice(0, 40) || "Text_Query");

      const formData = new FormData();
      formData.append("message", text);

      const response = await apiClient.post(
        `/api/v1/Message/${activeChatId}`,
        formData,
        { headers: { "Content-Type": undefined } }
      );

      const data = response.data;
      setMessages((prev) => [
        ...prev,
        {
          sender          : "bot",
          text            : data.response || data.message || "Analysis complete.",
          label           : data.status   || "Safe",
          vulnDtos        : data.vulnDtos || [],
          fileReport      : data.fileReport,
          repairedFile    : data.repairedFile,
          repairedFileName: data.repairedFileName,
          createdAt       : data.createdAt,
        },
      ]);

      if (isNew) applyChatRename(activeChatId, deriveChatTitle(data, text.slice(0, 40)));
    } catch (err) {
      const errorData = err.response?.data;
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text  : `QUERY_FAILURE: ${errorData?.message || "Neural Link Failed."}`,
          label : "Error",
        },
      ]);
    } finally {
      setIsScanning(false);
      fetchHistory();
    }
  };

  const processMultipleFiles = async (files) => {
    if (!files || files.length === 0) return;
    setIsScanning(true);
    if (!started) setStarted(true);
    let activeChatId;
    let isNewChat = false;
    try {
      const ensured = await ensureChat(files[0].name);
      activeChatId  = ensured.id;
      isNewChat     = ensured.isNew;
    } catch (err) {
      console.error("Failed to initialize session", err);
      setIsScanning(false);
      return;
    }
    for (const file of files) {
      try {
        setMessages((prev) => [
          ...prev,
          { sender: "user", text: `[SYSTEM_WAIT] INGESTING_NODE: ${file.name}` },
        ]);
        const formData = new FormData();
        formData.append("formFile", file);
        const response = await apiClient.post(`/api/v1/Message/${activeChatId}`, formData);
        const data     = response.data;
        setMessages((prev) => [
          ...prev,
          {
            sender          : "bot",
            text            : data.status === "Safe"
              ? `Analysis of ${file.name} Synchronized. All protocols safe.`
              : `Vulnerability Scan Complete for ${file.name}. Status: ${data.status}`,
            label           : data.status    || "Safe",
            vulnDtos        : data.vulnDtos  || [],
            fileReport      : data.fileReport,
            repairedFile    : data.repairedFile,
            repairedFileName: data.repairedFileName,
            fileName        : file.name,
            createdAt       : data.createdAt,
          },
        ]);

        if (isNewChat) {
          applyChatRename(activeChatId, deriveChatTitle(data, file.name));
          isNewChat = false;
        }
      } catch (err) {
        const errorData = err.response?.data;
        setMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text  : `NODE_FAILURE [${file.name}]: ${errorData?.message || "Neural Link Failed."}`,
            label : "Critical",
          },
        ]);
      }
    }
    setIsScanning(false);
    fetchHistory();
  };

  const sendMessage = async () => {
    if (!input.trim() && !stagedCode) return;
    if (textareaRef.current)      { textareaRef.current.style.height      = "auto"; }
    if (textareaIntroRef.current) { textareaIntroRef.current.style.height = "auto"; }
    if (stagedCode) {
      const ext         = detectedLang === "js" ? "js" : (detectedLang || "txt");
      const virtualFile = new File([stagedCode], `neural_snippet.${ext}`, { type: "text/plain" });
      setStagedCode(null);
      setInput("");
      await processMultipleFiles([virtualFile]);
    } else {
      const textContent = input.trim();
      setInput("");
      await sendTextMessage(textContent);
    }
  };

  const userInitial = (user?.name || "U").charAt(0).toUpperCase();

  return (
    <div className="w-full h-screen relative bg-[#020202] [[data-theme=light]_&]:bg-transparent overflow-hidden font-inter selection:bg-purple-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;900&family=Space+Grotesk:wght@700&family=Space+Mono&display=swap');
        .font-space { font-family: 'Space Grotesk', sans-serif; }
        .font-mono  { font-family: 'Space Mono', monospace; }
        .custom-scrollbar::-webkit-scrollbar       { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
        [data-theme=light] .custom-scrollbar::-webkit-scrollbar-thumb { background: #d1d5db; }
        [data-theme=light] .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
        .scan-laser {
          position: absolute; width: 100%; height: 2px;
          background: linear-gradient(to right, transparent, #8b5cf6, transparent);
          box-shadow: 0 0 20px #8b5cf6;
          z-index: 100; top: -10%; animation: laser 2s infinite;
        }
        @keyframes laser { from { top: -5%; } to { top: 105%; } }

        [data-theme=light] {
          --tok-keyword  : #6d28d9;
          --tok-builtin  : #0369a1;
          --tok-string   : #065f46;
          --tok-comment  : #9ca3af;
          --tok-number   : #b45309;
          --tok-func     : #92400e;
          --tok-operator : #374151;
          --tok-attribute: #9d174d;
          --tok-tag      : #1d4ed8;
          --tok-plain    : #111827;
        }

        [data-theme=light] .spline-canvas-wrap {
          display: none;
        }

        @keyframes pulse-pdf {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-pulse-pdf { animation: pulse-pdf 1s ease-in-out infinite; }
      `}</style>

      {/* ── BACKGROUND ──────────────────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0 spline-canvas-wrap">
        <Spline scene="https://prod.spline.design/u6UUd9ny38gtOZtR/scene.splinecode" />
        <div className="absolute inset-0 bg-black/20 pointer-events-none spline-overlay" />
      </div>

      <div className="absolute inset-0 z-0 hidden [[data-theme=light]_&]:block">
        <Spline scene="https://prod.spline.design/k7kCckIOWG8wN-pO/scene.splinecode" />
      </div>

      {/* ── TOP NAV ─────────────────────────────────────────────────────────── */}
      <header className="absolute top-0 inset-x-0 h-24 px-10 flex items-center justify-between z-50 pointer-events-none">
        <div className="flex items-center gap-8 pointer-events-auto">
          <button
            onClick={() => setSidebarOpen(true)}
            className="group flex items-center gap-4 px-6 py-2.5 rounded-full border border-white/5 [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.02] [[data-theme=light]_&]:bg-white/80 [[data-theme=light]_&]:shadow-sm backdrop-blur-xl hover:bg-white/[0.05] [[data-theme=light]_&]:hover:bg-white transition-all"
          >
            <Box size={16} className="text-purple-500 group-hover:rotate-90 transition-transform duration-500" />
            <span className="text-[10px] font-mono font-bold tracking-[0.4em] text-zinc-400 [[data-theme=light]_&]:text-zinc-700 uppercase">Side_Bar</span>
          </button>
          <div className="hidden lg:flex items-center gap-6 opacity-30 [[data-theme=light]_&]:opacity-80 border-l border-white/10 [[data-theme=light]_&]:border-l-black/10 pl-8">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-mono text-zinc-500 [[data-theme=light]_&]:text-zinc-600 uppercase">Bitrate</span>
              <span className="text-[10px] font-mono text-white [[data-theme=light]_&]:text-black tracking-widest">1,024 GB/s</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-mono text-zinc-500 [[data-theme=light]_&]:text-zinc-600 uppercase">Node</span>
              <span className="text-[10px] font-mono text-white [[data-theme=light]_&]:text-black tracking-widest">Global_Secure</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-600 uppercase tracking-widest leading-none">Security_Admin</span>
            <span className="text-sm font-bold text-white [[data-theme=light]_&]:text-black tracking-tight uppercase leading-none font-space">{user?.name || "user"}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/5 [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-md border border-white/10 [[data-theme=light]_&]:border-black/10 flex items-center justify-center text-white [[data-theme=light]_&]:text-black font-black shadow-2xl overflow-hidden group">
            <span className="group-hover:scale-125 transition-transform">{userInitial}</span>
          </div>
        </div>
      </header>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-[100] bg-black/90 [[data-theme=light]_&]:bg-black/40 backdrop-blur-md"
            />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="fixed top-0 left-0 h-full w-[400px] z-[101] border-r border-white/[0.05] [[data-theme=light]_&]:border-r-black/[0.08] bg-[#050505] [[data-theme=light]_&]:bg-white [[data-theme=light]_&]:shadow-2xl p-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-16">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                    <Terminal size={20} />
                  </div>
                  <span className="text-2xl font-bold font-space text-white [[data-theme=light]_&]:text-black tracking-tighter uppercase">HISTORY</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="p-2 text-zinc-600 [[data-theme=light]_&]:text-zinc-500 hover:text-white [[data-theme=light]_&]:hover:text-black">
                  <X size={20} />
                </button>
              </div>

              <button
                onClick={handleNewChat}
                className="w-full h-14 rounded-2xl border border-white/[0.05] [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.02] [[data-theme=light]_&]:bg-black/[0.02] hover:bg-white/5 [[data-theme=light]_&]:hover:bg-black/[0.05] transition-all text-[10px] font-bold uppercase tracking-[0.4em] text-white [[data-theme=light]_&]:text-black flex items-center justify-center gap-4 mb-10 group"
              >
                <Plus size={16} className="group-hover:scale-125 transition-transform" /> NEW_LINK_ESTABLISHED
              </button>

              <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <h4 className="text-[9px] font-mono text-zinc-700 [[data-theme=light]_&]:text-zinc-500 tracking-[0.5em] uppercase mb-8">Access_History</h4>
                <div className="space-y-4">
                  {chatsHistory.map((chat) => {
                    const cid = chat.chatId || chat.id;
                    const isEditing = editingChatId === cid;
                    return (
                      <div
                        key={cid}
                        onClick={() => !isEditing && handleSelectOldChat(cid)}
                        className={`group relative p-5 rounded-2xl border transition-all cursor-pointer ${
                          currentChatId === cid
                            ? "bg-purple-600/5 [[data-theme=light]_&]:bg-purple-500/5 border-purple-500/30"
                            : "bg-transparent border-white/[0.03] [[data-theme=light]_&]:border-black/[0.06] hover:border-white/10 [[data-theme=light]_&]:hover:border-black/10 hover:bg-white/[0.01] [[data-theme=light]_&]:hover:bg-black/[0.02]"
                        }`}
                      >
                        <div className="flex flex-col gap-2 pr-12">
                          {isEditing ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  cancelRenameRef.current = false;
                                  handleRenameSubmit(cid);
                                }
                                if (e.key === "Escape") {
                                  cancelRenameRef.current = true;
                                  setEditingChatId(null);
                                  setRenameValue("");
                                }
                              }}
                              onBlur={() => {
                                if (!cancelRenameRef.current) handleRenameSubmit(cid);
                                cancelRenameRef.current = false;
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="bg-transparent border-b border-purple-500 outline-none text-white [[data-theme=light]_&]:text-black text-sm font-bold font-space w-full pb-0.5 caret-purple-400"
                            />
                          ) : (
                            <span className="text-sm font-bold text-zinc-300 [[data-theme=light]_&]:text-zinc-800 truncate font-space tracking-tight">
                              {chat.chatName || "Analysis_Log"}
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 uppercase">
                            {new Date(chat.createdAt).toDateString()}
                          </span>
                        </div>

                        {!isEditing && (
                          <div className="absolute right-5 top-1/2 -translate-y-1/2 flex gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChatId(cid);
                                setRenameValue(chat.chatName || "");
                              }}
                              className="text-zinc-500 hover:text-purple-400 transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteChat(e, cid)}
                              className="text-zinc-500 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-10 pt-10 border-t border-white/[0.05] [[data-theme=light]_&]:border-t-black/[0.08]">
                <button
                  onClick={logout}
                  className="flex items-center gap-4 text-zinc-600 [[data-theme=light]_&]:text-zinc-500 hover:text-red-400 [[data-theme=light]_&]:hover:text-red-600 transition-all text-[10px] font-black uppercase tracking-widest"
                >
                  <LogOut size={16} /> Terminate Clearance
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── MAIN COMMAND HUB ────────────────────────────────────────────────── */}
      <main className="absolute inset-0 z-20 flex flex-col items-center pointer-events-none">
        <AnimatePresence mode="wait">
          {!started ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.8, ease: "circOut" }}
              className="mt-[22vh] text-center max-w-4xl px-10"
            >
              <motion.div className="space-y-6">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="inline-flex items-center gap-4 px-5 py-2 rounded-full border border-white/5 [[data-theme=light]_&]:border-black/[0.08] bg-white/[0.02] [[data-theme=light]_&]:bg-white/70 [[data-theme=light]_&]:shadow-sm backdrop-blur-xl mb-6"
                >
                  <Radio size={14} className="text-purple-500 animate-pulse" />
                  <span className="text-[9px] font-mono tracking-[0.5em] text-zinc-500 [[data-theme=light]_&]:text-zinc-700 uppercase">
                    Server Is Ready & Connected {userInitial}
                  </span>
                </motion.div>
                <motion.h1 className="text-7xl md:text-9xl font-black font-space text-white [[data-theme=light]_&]:text-black tracking-tighter leading-[0.8] mb-8">
                  <span className="text-zinc-800 [[data-theme=light]_&]:text-zinc-400">VULN</span>SNEAK<span className="text-zinc-800 [[data-theme=light]_&]:text-zinc-400">.</span>
                </motion.h1>
                <motion.p className="text-zinc-500 [[data-theme=light]_&]:text-zinc-600 text-xl font-light max-w-2xl mx-auto leading-relaxed">
                  Autonomous security platform utilizing <span className="text-white [[data-theme=light]_&]:text-black font-semibold">Cyber models</span> for
                  Zero-Days vulnerability detection for you to be safe.
                </motion.p>
              </motion.div>

              <motion.div className="w-full max-w-3xl mt-6 relative pointer-events-auto">
                <AnimatePresence>
                  {stagedCode && (
                    <StagedCodePreview
                      stagedCode={stagedCode}
                      detectedLang={detectedLang}
                      onEdit={() => { setInput(stagedCode); setStagedCode(null); }}
                      onClear={() => { setStagedCode(null); setInput(""); }}
                    />
                  )}
                </AnimatePresence>

                <div className={`flex items-start bg-[#080808]/95 border border-black backdrop-blur-3xl shadow-[0_0_100px_rgba(0,0,0,1)] group transition-all duration-300 ${
                  stagedCode ? "rounded-2xl px-6 py-4" : "rounded-full px-6 py-6"
                }`}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 mt-1 text-zinc-600 hover:text-white transition-all transform hover:rotate-90 group-focus-within:text-purple-500 flex-shrink-0"
                  >
                    <Layers size={22} />
                  </button>
                  <textarea
                    ref={textareaIntroRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                      handleInputChange(e.target.value);
                      autoResize(e.target);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder="Type a message or paste code to scan…"
                    className="flex-1 bg-transparent border-none outline-none text-white text-base px-6 font-light placeholder:text-zinc-700 resize-none overflow-hidden leading-relaxed py-1"
                    style={{ minHeight: "28px", maxHeight: "160px" }}
                  />
                  <div className="flex items-center gap-3 mt-1 flex-shrink-0">
                    <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
                      {stagedCode ? "CODE" : "TEXT"}
                    </span>
                    <button
                      onClick={sendMessage}
                      className="h-10 px-8 rounded-full bg-white text-black font-black text-[10px] uppercase tracking-[0.4em] hover:bg-zinc-200 active:scale-95 transition-all whitespace-nowrap"
                    >
                      Execute
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="w-full h-full pt-32 pb-40 flex flex-col items-center"
            >
              {/* ── EXPORT PDF FLOATING BUTTON ──────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute top-28 right-10 z-30 pointer-events-auto"
              >
                <button
                  onClick={generateChatPDF}
                  disabled={isExportingPDF || messages.length === 0}
                  title="Export chat as PDF"
                  className={`group flex items-center gap-3 px-5 py-2.5 rounded-full border backdrop-blur-xl transition-all duration-300 ${
                    isExportingPDF
                      ? "border-purple-500/50 bg-purple-500/10 cursor-wait"
                      : "border-white/10 [[data-theme=light]_&]:border-black/[0.1] bg-black/40 [[data-theme=light]_&]:bg-white/80 [[data-theme=light]_&]:shadow-sm hover:border-purple-500/50 hover:bg-purple-500/10 active:scale-95"
                  }`}
                >
                  {isExportingPDF ? (
                    <Loader2 size={14} className="text-purple-400 animate-spin" />
                  ) : (
                    <FileText size={14} className="text-purple-400 group-hover:text-purple-300 transition-colors" />
                  )}
                  <span className="text-[9px] font-mono font-bold uppercase tracking-[0.3em] text-zinc-400 [[data-theme=light]_&]:text-zinc-600 group-hover:text-purple-300 [[data-theme=light]_&]:group-hover:text-purple-600 transition-colors whitespace-nowrap">
                    {isExportingPDF ? "Generating…" : "Export_PDF"}
                  </span>
                </button>
              </motion.div>

              <div
                ref={chatContainerRef}
                className="w-full max-w-4xl flex-1 overflow-y-auto px-10 space-y-16 custom-scrollbar scroll-smooth"
              >
                <AnimatePresence mode="popLayout">
                  {messages.map((msg, i) => (
                    <motion.div
                      key={i}
                      layout
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`max-w-[100%]  ${msg.sender === "user" ? "w-auto" : "w-full"}`}>
                        {msg.sender === "user" ? (
                          <div className="flex flex-col items-end gap-3">
                            <div className="pointer-events-auto flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 [[data-theme=light]_&]:bg-black/[0.05] border border-white/5 [[data-theme=light]_&]:border-black/[0.08] mb-1">
                              <MessageSquare size={10} className="text-zinc-600 [[data-theme=light]_&]:text-zinc-600" />
                              <span className="pointer-events-auto text-[8px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-600 uppercase tracking-widest">
                                {msg.isText ? "text_query" : "file_upload"}
                              </span>
                            </div>
                            <div className="pointer-events-auto px-6 py-4 rounded-2xl bg-white [[data-theme=light]_&]:bg-zinc-900 text-black [[data-theme=light]_&]:text-white font-bold font-space text-sm tracking-tight shadow-xl">
                              {msg.text}
                            </div>
                            <span className="text-[8px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 tracking-[0.5em] uppercase">Status: Ingested</span>
                          </div>
                        ) : (
                          <div className="space-y-10">
                            <div className="flex items-center gap-5">
                              <motion.div
                                animate={{ boxShadow: ["0 0 0px rgba(168,85,247,0)","0 0 20px rgba(168,85,247,0.4)","0 0 0px rgba(168,85,247,0)"] }}
                                transition={{ repeat: Infinity, duration: 2 }}
                                className="w-10 h-10 rounded-2xl bg-purple-600 flex items-center justify-center text-white"
                              >
                                <img
                                  src="/assets/icon1.svg"
                                  className="w-[32px] h-[32px]"
                                  alt="shield"
                                />
                              </motion.div>
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black font-mono tracking-[0.4em] text-purple-500 uppercase leading-none">VulnSneak-Engine</span>
                                <span className="text-[8px] font-mono text-zinc-600 [[data-theme=light]_&]:text-zinc-500 uppercase tracking-widest mt-1">Ref_ID: {Math.floor(Math.random() * 999999)}</span>
                              </div>
                            </div>

                            <div className="pointer-events-auto max-w-3xl p-6 md:p-8 rounded-3xl backdrop-blur-xl border shadow-xl transition-all duration-300
                                            bg-white/[0.02] [[data-theme=light]_&]:bg-black/[0.03]
                                            border-white/[0.06] [[data-theme=light]_&]:border-black/[0.08]
                                            text-sm md:text-base font-semibold text-zinc-300 [[data-theme=light]_&]:text-zinc-800 leading-relaxed"
                            >
                              <MarkdownMessage content={msg.text} />
                            </div>

                            {msg.detail && (
                              <motion.p className="pointer-events-auto text-xs text-zinc-500 [[data-theme=light]_&]:text-zinc-700 font-mono bg-white/5 [[data-theme=light]_&]:bg-black/[0.04] p-4 border border-white/5 [[data-theme=light]_&]:border-black/[0.08] rounded-xl italic">
                                {msg.detail}
                              </motion.p>
                            )}

                            <div className="space-y-4">
                              {msg.vulnDtos?.map((vuln, vIdx) => (
                                <NeuralCodeIntelligence
                                  key={vIdx}
                                  vuln={vuln}
                                  language={detectedLang || "source_link"}
                                />
                              ))}
                            </div>

                            <div className=" pointer-events-auto flex flex-wrap gap-4">
                              {msg.fileReport && (
                                <button
                                  onClick={() => downloadFile(msg.fileReport, `REPORT_${msg.fileName}`)}
                                  className="group flex items-center gap-6 px-8 py-5 rounded-2xl bg-white/[0.03] [[data-theme=light]_&]:bg-white border border-white/10 [[data-theme=light]_&]:border-black/[0.08] [[data-theme=light]_&]:shadow-sm hover:bg-white [[data-theme=light]_&]:hover:bg-black hover:text-black [[data-theme=light]_&]:hover:text-white transition-all"
                                >
                                  <Download size={20} className="text-purple-500 group-hover:text-black [[data-theme=light]_&]:group-hover:text-white" />
                                  <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] [[data-theme=light]_&]:text-black [[data-theme=light]_&]:group-hover:text-white">Repaired_Code</span>
                                    <span className="text-[9px] font-mono opacity-40 [[data-theme=light]_&]:opacity-60 uppercase tracking-widest [[data-theme=light]_&]:text-zinc-700 [[data-theme=light]_&]:group-hover:text-white/60">Encrypted_File</span>
                                  </div>
                                  <ChevronRight size={16} className="ml-auto opacity-20" />
                                </button>
                              )}
                              {msg.repairedFile && (
                                <button
                                  onClick={() => downloadFile(msg.repairedFile, msg.repairedFileName, "application/octet-stream")}
                                  className="group flex items-center gap-6 px-8 py-5 rounded-2xl bg-emerald-500/5 [[data-theme=light]_&]:bg-emerald-500/10 border border-emerald-500/20 [[data-theme=light]_&]:border-emerald-300 hover:bg-emerald-500 [[data-theme=light]_&]:hover:bg-emerald-600 hover:text-white transition-all"
                                >
                                  <Zap size={20} className="text-emerald-500 group-hover:text-white" />
                                  <div className="flex flex-col items-start">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] [[data-theme=light]_&]:text-emerald-950 [[data-theme=light]_&]:group-hover:text-white">Repaired_Source_Code</span>
                                    <span className="text-[9px] font-mono opacity-40 [[data-theme=light]_&]:opacity-60 uppercase tracking-widest [[data-theme=light]_&]:text-emerald-900 [[data-theme=light]_&]:group-hover:text-white/60">Neural_Remedy_File</span>
                                  </div>
                                  <ChevronRight size={16} className="ml-auto opacity-20" />
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-10 pt-10 border-t border-white/[0.03] [[data-theme=light]_&]:border-t-black/[0.08]">
                              <Metric label="Analysis_Time" value={`${msg.vulnDtos?.[0]?.Repair?.ElapsedSecs || msg.vulnDtos?.[0]?.elapsedSecs || 0}s`} icon={<Activity size={10} />} />
                              <Metric label="Core_Load"    value={`${Math.floor(Math.random() * 30 + 10)}%`} icon={<Cpu size={10} />} />
                              <Metric label="Model"        value={`${msg.vulnDtos?.[0]?.Repair?.ModelUsed || msg.vulnDtos?.[0]?.modelUsed || "None"}`} icon={<Globe size={10} />} />
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}

                  {isScanning && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-start w-full pointer-events-none"
                    >
                      <ShinyThinking />
                    </motion.div>
                  )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
              </div>

              {/* ── BOTTOM INPUT ─────────────────────────────────────────────── */}
              <motion.div className="absolute bottom-12 w-full max-w-4xl px-10 pointer-events-auto">
                <div className="relative">
                  <AnimatePresence>
                    {stagedCode && (
                      <StagedCodePreview
                        stagedCode={stagedCode}
                        detectedLang={detectedLang}
                        onEdit={() => { setInput(stagedCode); setStagedCode(null); }}
                        onClear={() => { setStagedCode(null); setInput(""); }}
                      />
                    )}
                  </AnimatePresence>

                  <div className={`flex items-start bg-black/80 border border-white/[0.08] backdrop-blur-3xl shadow-[0_50px_100px_rgba(0,0,0,1)] group focus-within:border-purple-500/50 transition-all duration-300 ${
                    stagedCode ? "rounded-2xl p-3" : "rounded-full p-2.5"
                  }`}>
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 mt-0.5 text-zinc-500 hover:text-white transition-all flex-shrink-0">
                      <Layers size={22} />
                    </button>
                    <textarea
                      ref={textareaRef}
                      rows={1}
                      value={input}
                      onChange={(e) => {
                        handleInputChange(e.target.value);
                        autoResize(e.target);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder={stagedCode ? "Add a comment or execute scan…" : "Type a message or paste code to scan…"}
                      className="flex-1 bg-transparent border-none outline-none text-white font-light text-sm px-5 resize-none overflow-hidden leading-relaxed py-2"
                      style={{ minHeight: "28px", maxHeight: "160px" }}
                    />
                    <div className="flex items-center gap-2 mt-0.5 flex-shrink-0">
                      <span className={`text-[8px] font-mono uppercase tracking-[0.3em] px-2 py-1 rounded-full border transition-all ${
                        stagedCode
                          ? "text-purple-400 border-purple-500/30 bg-purple-500/10"
                          : "text-zinc-600 border-white/5"
                      }`}>
                        {stagedCode ? "CODE" : "TEXT"}
                      </span>

                      <button
                        onClick={generateChatPDF}
                        disabled={isExportingPDF || messages.length === 0}
                        title="Export chat as PDF"
                        className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all ${
                          isExportingPDF
                            ? "border-purple-500/40 bg-purple-500/10 cursor-wait"
                            : "border-white/10 text-zinc-500 hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-400 active:scale-95"
                        }`}
                      >
                        {isExportingPDF
                          ? <Loader2 size={14} className="text-purple-400 animate-spin" />
                          : <FileText size={14} />
                        }
                      </button>

                      <button
                        onClick={sendMessage}
                        className="h-10 px-8 rounded-full bg-purple-600 text-white font-bold text-[10px] uppercase tracking-[0.4em] hover:bg-purple-500 transition-all flex items-center gap-2 whitespace-nowrap"
                      >
                        EXECUTE <Zap size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length > 0) processMultipleFiles(files);
          e.target.value = null;
        }}
        className="hidden"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Metric = ({ label, value, icon }) => (
  <div className="flex items-center gap-3 opacity-30 [[data-theme=light]_&]:opacity-70 group hover:opacity-100 transition-opacity">
    <div className="text-zinc-500 [[data-theme=light]_&]:text-zinc-600">{icon}</div>
    <div className="flex flex-col">
      <span className="text-[8px] font-mono text-zinc-500 [[data-theme=light]_&]:text-zinc-600 uppercase tracking-widest">{label}</span>
      <span className="text-[10px] font-mono text-white [[data-theme=light]_&]:text-black uppercase tracking-tighter">{value}</span>
    </div>
  </div>
);

const ShieldCheck = ({ size, className }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" className={className}
  >
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);