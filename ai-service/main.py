"""
VulnSneak API — main.py
========================
FastAPI service that exposes the VulnSneak pipeline.

Endpoints (unchanged):
  GET  /health    — check all services are running
  POST /analyze   — scan + repair + report + repaired file
  POST /chat      — scoped cybersecurity assistant

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import uvicorn
from fastapi                 import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import API_HOST, API_PORT, CORS_ORIGINS
from scanner      import scan
from repair_agent import repair_all, check_ollama, validator_availability
from chat_agent   import chat

from models import (
    RepairInfo,
    VulnFinding,
    ScanInfo,
    ReportSummary,
    VulnSneakReport,
    HealthResponse,
    ChatRequest,
    ChatResponse,
)


# ── App ────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title       = "VulnSneak API",
    description = "Two-stage vulnerability detection, region-based repair, and chat pipeline",
    version     = "2.0.0",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# allow_origins=["*"] + allow_credentials=True is rejected by browsers and is
# a privacy smell besides — list real frontend origin(s) via CORS_ORIGINS in
# config.py / the CORS_ORIGINS environment variable instead.
app.add_middleware(
    CORSMiddleware,
    allow_origins     = CORS_ORIGINS,
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)


# ── Health Check ───────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
def health():
    from scanner import binary_model, family_model
    return HealthResponse(
        status       = "ok",
        binary_model = "loaded" if binary_model else "error",
        family_model = "loaded" if family_model else "error",
        ollama       = check_ollama(),
        validators   = validator_availability(),
    )


# ── Analyze Endpoint ───────────────────────────────────────────────────────────

@app.post("/analyze", response_model=VulnSneakReport)
async def analyze(file: UploadFile = File(...)):
    """
    Full pipeline:
      1. Validate file type and content
      2. Detect vulnerabilities (Binary + Family Model)
      3. Repair each vulnerability — region-based repair with retries and
         syntax/security validation (see repair_agent.repair_all)
      4. Return full report + repaired file
    """
    # ── Validate file type ─────────────────────────────────────────────────
    allowed = {
        ".py", ".java", ".js", ".php", ".cs", ".cpp", ".c",
        ".html", ".xml",
        ".ts", ".jsx", ".tsx",
        ".jsp", ".aspx",
        ".rb", ".go", ".txt",
    }
    suffix = "." + file.filename.split(".")[-1].lower() if "." in file.filename else ""

    if suffix not in allowed:
        raise HTTPException(
            status_code = 400,
            detail      = f"Unsupported file type: {suffix}. Allowed: {allowed}",
        )

    # ── Read file ──────────────────────────────────────────────────────────
    try:
        content = await file.read()
        code    = content.decode("utf-8", errors="replace")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {exc}")

    # ── Empty file check ───────────────────────────────────────────────────
    if not code.strip():
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # ── Build repaired filename ────────────────────────────────────────────
    base_name         = file.filename.rsplit(".", 1)[0] if "." in file.filename else file.filename
    repaired_filename = f"{base_name}_repaired{suffix}"

    # ── Scan ───────────────────────────────────────────────────────────────
    print(f"[API] Scanning: {file.filename}")
    scan_result = scan(code, filename=file.filename)

    # ── Safe ───────────────────────────────────────────────────────────────
    if scan_result["status"] == "Safe":
        print("[API] Result: Safe.")
        return VulnSneakReport(
            Filename = scan_result["filename"],
            Status   = "Safe",
            Scan     = ScanInfo(
                TotalChunks      = scan_result["total_chunks"],
                VulnerableChunks = 0,
            ),
            Findings = [],
            Summary  = ReportSummary(
                TotalVulnerabilities = 0,
                RepairedSuccessfully = 0,
                ModelsUsed           = [],
            ),
            RepairedFile     = None,
            RepairedFilename = None,
        )

    # ── Repair ─────────────────────────────────────────────────────────────
    print(f"[API] Found {len(scan_result['vulnerabilities'])} vulnerability/vulnerabilities.")
    print("[API] Starting repair...")

    findings_raw, repaired_file_content = repair_all(
        vulnerabilities = scan_result["vulnerabilities"],
        original_code   = code,
        filename        = file.filename,
    )

    print(f"[API] Repaired file built: {repaired_filename}")

    # ── Build findings ─────────────────────────────────────────────────────
    findings = [
        VulnFinding(
            VulnName    = f["label"],
            Confidence  = f["confidence"],
            StartLine   = f["start_line"],
            EndLine     = f["end_line"],
            VulnLines   = f.get("vuln_lines", []),
            CodeSnippet = f["evidence_snippet"],
            Repair      = RepairInfo(
                Success                    = f["repair"]["success"],
                RepairedCode               = f["repair"]["repaired_code"],
                Explanation                = f["repair"]["explanation"],
                ModelUsed                  = f["repair"]["model_used"],
                ElapsedSecs                = f["repair"]["elapsed_seconds"],
                Error                      = f["repair"]["error"],
                Status                     = f["repair"]["status"],
                Imports                    = f["repair"]["imports"],
                RegionStart                = f["repair"]["region_start"],
                RegionEnd                  = f["repair"]["region_end"],
                ValidationPassed           = f["repair"]["validation_passed"],
                ValidationError            = f["repair"]["validation_error"],
                SyntaxValidationAvailable  = f["repair"]["syntax_validation_available"],
            ),
        )
        for f in findings_raw
    ]

    models_used = list({
        f["repair"]["model_used"]
        for f in findings_raw
        if f["repair"]["success"]
    })

    print("[API] Done. Returning report.")

    return VulnSneakReport(
        Filename = scan_result["filename"],
        Status   = "Vulnerable",
        Scan     = ScanInfo(
            TotalChunks      = scan_result["total_chunks"],
            VulnerableChunks = scan_result["vulnerable_chunks"],
        ),
        Findings = findings,
        Summary  = ReportSummary(
            TotalVulnerabilities = len(findings),
            RepairedSuccessfully = sum(1 for f in findings_raw if f["repair"]["success"]),
            ModelsUsed           = models_used,
        ),
        RepairedFile     = repaired_file_content,
        RepairedFilename = repaired_filename,
    )


# ── Chat Endpoint ──────────────────────────────────────────────────────────────

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    Scoped cybersecurity assistant.

    Accepts a user message and optional conversation history.
    Returns a response restricted to vulnerability and security topics only.

    The history should be a list of previous turns:
      [
        {"role": "user",      "content": "What is SQL Injection?"},
        {"role": "assistant", "content": "SQL Injection is..."},
        ...
      ]
    """
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    print(f"[API] Chat message received. History length: {len(request.history)}")

    history = [{"role": m.role, "content": m.content} for m in request.history]

    result = chat(
        user_message = request.message,
        history      = history,
    )

    print(f"[API] Chat response from: {result['model_used']}")

    return ChatResponse(
        success    = result["success"],
        response   = result["response"],
        model_used = result["model_used"],
        error      = result["error"],
    )


# ── Run ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host   = API_HOST,
        port   = API_PORT,
        reload = True,
    )
