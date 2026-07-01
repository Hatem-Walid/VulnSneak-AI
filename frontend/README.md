# 🎨 VulnSneak — Frontend

The client-side application for VulnSneak: a high-fidelity, performance-optimized Single Page Application (SPA) that lets developers submit source code, watch AI vulnerability analysis happen in real time, and review/export AI-generated repairs.

Part of the [VulnSneak](../README.md) graduation project (Zagazig University, 2025–2026).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Core UI | React 18.2 (concurrent rendering) |
| Build tool | Vite 7.2 (Rollup-based production builds, fast HMR) |
| Styling | Tailwind CSS v4 (compiles to CSS variables for theming) |
| State | React Context API (auth + theme — no external state library) |
| 3D / Graphics | Spline, React Three Fiber, OGL (custom WebGL/GLSL shaders) |
| Animation | Framer Motion, GSAP 3 + ScrollTrigger |
| Markdown | react-markdown with RTL/Arabic support |
| PWA | Custom Service Worker (offline queueing, background sync, push) |

---

## ✨ Notable Frontend Systems

- **`SplineAgentPage.jsx`** — the primary scan dashboard. Renders vulnerability data, side-by-side original-vs-repaired code diffs, and step-by-step remediation guidance using a custom-built syntax tokenizer (no external parsing library).
- **`LiquidChrome.jsx`** — a WebGL fluid-chrome background driven by custom GLSL shaders (via the lightweight OGL framework), reacting to cursor position in real time.
- **`Antigravity.jsx`** — an instanced 3D particle system (up to 300 particles) built with React Three Fiber, with magnetic force-field behavior around the cursor.
- **`CardSwap.jsx`** — GSAP-timeline-driven 3D card cycling with Z-axis depth ordering.
- **`CustomCursor.jsx`** — dual-node cursor (precision dot + lagging outer ring) with a `MutationObserver` that auto-binds interaction handlers to dynamically rendered elements.
- **`FlowchartSection.jsx`** — interactive glassmorphic architecture diagram with a full-screen lightbox modal.
- **`ThemeContext.jsx`** — persists dark/light preference to `localStorage`, applied via root-level class toggling (zero component re-renders).
- **`AuthContext.jsx`** — stores JWTs in `sessionStorage` (not `localStorage`) to reduce XSS token-theft exposure; cleared automatically on tab close.
- **`ToastProvider.jsx`** — lightweight custom notification system (no third-party toast library).
- **PDF export engine** — generates scan reports with full Arabic text reshaping (contextual glyph mapping: isolated/initial/medial/final forms) and dynamically embeds an Arabic-compatible font for correct RTL rendering.
- **`RetellAgent.jsx`** — WebRTC voice interaction via the Retell AI SDK; the backend issues short-lived tokens so no service credentials are ever exposed client-side.
- **`apiClient.js`** — centralized Axios instance; a request interceptor automatically injects the JWT `Authorization` header on every call.
- **Service Worker (`sw.js`)** — network-first caching for JS/CSS bundles, cache-first for the app shell, and background-sync request queueing so a scan submitted offline is retried automatically once connectivity returns.

---

## 🚀 Getting Started

```bash
npm install
npm run dev
```

Build for production:
```bash
npm run build
```

### Environment variables
Create a `.env` file (see `.env.example` if present):
```
VITE_API_URL=<.NET backend URL>
VITE_AI_URL=<FastAPI AI service URL>
```

---

## 📦 Deployment

Deployed on **Vercel**. When connecting this repo on Vercel, set:
- **Root Directory:** `frontend`
- **Framework Preset:** Vite

---

## 🧹 ESLint

This project uses ESLint with React-aware rules. For production-grade type-aware linting, consider migrating to the [TypeScript + `typescript-eslint`](https://typescript-eslint.io) setup.

---

For the full system architecture, AI pipeline, and academic background, see the [root README](../README.md).
