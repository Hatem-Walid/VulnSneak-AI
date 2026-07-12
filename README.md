# 🛡️ VulnSneak — AI Agent for Sneaking into Vulnerabilities

**An AI-powered agent that automatically detects *and repairs* security vulnerabilities in frontend and backend source code.**

Final Year Graduation Project — Computer Science, Zagazig University (2025–2026)

---

## 📖 Overview

Manual code audits and traditional static analysis tools (SAST/DAST) don't scale well and often produce high false-positive rates or require deep security expertise to interpret. VulnSneak addresses this gap with a **multi-stage AI pipeline** that goes beyond detection: it locates the exact vulnerable lines in source code *and* generates context-aware, minimal-diff repairs — while preserving the original functionality of the code.

The system combines:
- Two supervised **Transformer classifiers** (binary + 8-class vulnerability family classification)
- A **region-based repair agent** powered by locally hosted LLMs with cloud fallback
- A **Raspberry Pi security proxy** that isolates the backend and AI services from direct exposure
- A cinematic, production-grade **web interface** for real-time interaction

---

## ✨ Key Features

- 🔍 **Two-stage vulnerability detection** — binary (vulnerable/safe) classification followed by 8-class vulnerability-family classification, using sliding-window segmentation (24-line chunks, stride 12) to handle large files with context
- 🎯 **Line-level precision** — pinpoints the exact vulnerable line(s) rather than flagging entire files
- 🩹 **Automated AI repair** — generates minimal, syntax-validated patches for vulnerable regions only, leaving all surrounding code untouched
- 🔐 **Raspberry Pi security gateway** — a hardware proxy layer that filters incoming/outgoing traffic and shields the backend + AI model from direct exposure
- 💬 **Conversational scanning agent** with voice interaction (WebRTC via Retell AI)
- 📄 **High-fidelity PDF export** with full Arabic/RTL text reshaping support
- 🎨 **Cinematic 3D interface** — WebGL shader backgrounds, GSAP ScrollTrigger, React Three Fiber particle systems, custom animated cursor
- 🌗 **Full dark/light theme system**
- 📴 **Progressive Web App (PWA)** — offline resilience with background sync for queued scan requests and push notifications on scan completion

---

## 🧠 AI Pipeline

| Stage | Component | Description |
|---|---|---|
| **1. Detection** | Binary Classifier (CodeBERT-based, Transformer) | Determines whether a code snippet is vulnerable or safe |
| **2. Classification** | 8-Class Vulnerability Classifier | Identifies the vulnerability family (SQLi, XSS, command injection, insecure deserialization, path traversal, CSRF, XML injection, insecure cryptography) |
| **3. Repair** | Region-Based Repair Agent | Sends only the vulnerable lines to `qwen2.5-coder:7b` (primary), `qwen3:4b` (lightweight fallback), or `gemini-2.5-flash` (cloud last-resort), guided by vulnerability-specific fix prompts |
| **4. Validation** | Syntax & Security Checks | Validates generated patches before they're presented to the developer |

Training pipeline built with **Hugging Face Transformers** and **PyTorch**, using tokenization, label encoding, and data augmentation on a curated dataset aggregated from Hugging Face, Kaggle, and custom-labeled examples.

---

## 🏗️ System Architecture

```
Developer → Frontend (React SPA)
                │
                ▼
     Raspberry Pi Security Proxy   ── filters incoming/outgoing traffic,
                │                     isolates backend & AI from direct exposure
                ▼
        .NET Backend (ASP.NET + EF Core + SQL Server)
                │                     handles auth, storage, orchestration
                ▼
        FastAPI AI Service (Python)
                │
        ┌───────┴────────┐
        ▼                ▼
  Detection Models   Repair Agent (Qwen models + cloud fallback)
   (binary + 8-class)
                │
                ▼
     Validated report → Frontend (code diff view, PDF export)
```

---

## 📁 Project Structure

```
VulnSneak-AI/
├── frontend/              # React 18 + Vite 7 SPA
│   ├── src/
│   │   ├── components/    # LiquidChrome, Antigravity, CardSwap, CustomCursor, ToastProvider...
│   │   ├── pages/         # SplineAgentPage.jsx (main scan dashboard), FlowchartSection.jsx
│   │   └── context/        # ThemeContext.jsx, AuthContext.jsx
│   └── package.json
│
├── backend-dotnet/         # ASP.NET Core + EF Core + SQL Server
│   ├── Controllers/
│   ├── Models/
│   └── VulnSneak.API.csproj
│
├── ai-service/              # Python FastAPI — detection + repair pipeline
│   ├── app/
│   ├── models/              # CodeBERT classifiers (binary + 8-class)
│   └── requirements.txt
│
├── raspberry-pi-proxy/      # Secure gateway / traffic filtering layer
│
├── dataset/                  # Curated vulnerable/fixed code dataset
│   └── README.md              # Sources & download instructions
│
├── docs/                      # Graduation report, diagrams, use case & flowcharts
│
└── README.md
```

> **Large files note:** Trained model weights and the full dataset are hosted externally (Hugging Face / Kaggle) rather than committed to Git — see [`dataset/README.md`](./dataset/README.md).

---

## 🛠️ Tech Stack

**Frontend**
- React 18.2, Vite 7.2, Tailwind CSS v4
- Framer Motion, GSAP 3 + ScrollTrigger
- Spline (3D scenes), React Three Fiber, OGL (custom WebGL shaders)
- react-markdown with RTL/Arabic support
- PWA with Service Worker (offline queueing, background sync, push notifications)

**Backend**
- ASP.NET Core, Entity Framework Core, SQL Server
- JWT-based authentication (session-storage token isolation against XSS)

**AI / ML**
- Python, FastAPI
- Hugging Face Transformers, PyTorch, TensorFlow
- CodeBERT (detection), Qwen2.5-Coder / Qwen3 (local repair), Gemini 2.5 Flash (cloud fallback)
- Trained on Google Colab / Kaggle (free-tier GPU)

**Security Infrastructure**
- Raspberry Pi as a hardware proxy/gateway isolating backend & AI services

**Deployment**
- Frontend → Vercel
- Backend (.NET) → Render / Railway
- AI Service (FastAPI) → Render / Railway / Hugging Face Spaces

---

## 🎯 Vulnerability Coverage (8 Classes)

SQL Injection (SQLi) · Cross-Site Scripting (XSS) · OS Command Injection · Insecure Deserialization · Path Traversal · Cross-Site Request Forgery (CSRF) · XML Injection · Insecure Cryptography

Labeling and repair guidance are aligned with **OWASP Top 10** and **CWE** standards.

---

## 🚀 Getting Started

Each service is independently deployable. See the README inside each folder for setup:

```bash
# Frontend
cd frontend
npm install
npm run dev
```

- [`backend-dotnet/README.md`](./backend-dotnet/README.md) *(coming soon)*
- [`ai-service/README.md`](./ai-service/README.md) *(coming soon)*

---

## 👥 Team

**Zagazig University — Computer Science**
**Supervised by:** Prof. Dr. Osama Sheta

| Name |
|---|
| Hatem Waleed Ragab Abdelfattah |
| Ibrahim Mahmoud Ibrahim AlDosooqy |
| Mohamed Khalid Mohamed Abdelwahab |
| Mohamed Hussein Ahmed Hussein |
| Ziad Ahmed Awad Mohamed |
| Youssef Amr Mohamed Ahmed |
| Mahmoud Saber Abumesallem Gad |
| Mohamed Mansour Mohamed Mansour |

---

## 📚 References & Data Sources

**Datasets:** Hugging Face (`darkknight25/Vulnerable_Programming_Dataset`, `CyberNative/Code_Vulnerability_Security_DPO`), Kaggle (vulnerability-fix dataset, code-vulnerabilities dataset, SQL injection dataset, custom `vulnsneak-final-model-v1`)

**Standards:** [OWASP Top 10](https://owasp.org/), CWE, OWASP Cheat Sheet Series

**Related work:** [Semgrep](https://semgrep.dev/), [Astra Security](https://www.getastra.com/)

Full reference list available in the graduation report ([`docs/`](./docs)).

---

## 🎓 Academic Context

This project was developed as a Final Year Graduation Project for the Bachelor's degree in Computer Science at Zagazig University (2025–2026), covering the full lifecycle from dataset curation and model training to a deployed, production-grade secure web platform.

## 📄 License

Developed for academic purposes as part of a graduation requirement.
