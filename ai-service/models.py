"""
VulnSneak API — models.py
==========================
Shared Pydantic schemas for all API requests/responses.

These were previously duplicated between main.py and models.py (main.py had
its own copies). main.py now imports everything from here instead.

Field names use the exact PascalCase contract the frontend already expects
(Success, RepairedCode, VulnName, StartLine, ...) — these are NOT renamed.
New fields are added with safe defaults so existing clients keep working
without changes.
"""

from pydantic import BaseModel, Field
from typing  import List, Optional


# ── Repair ─────────────────────────────────────────────────────────────────────

class RepairInfo(BaseModel):
    model_config = {"protected_namespaces": ()}

    # Original contract — unchanged, kept for frontend compatibility.
    Success      : bool
    RepairedCode : str
    Explanation  : str
    ModelUsed    : str
    ElapsedSecs  : float
    Error        : Optional[str] = ""

    # New fields from the redesigned repair pipeline. All optional/defaulted.
    Status                     : str       = "failed"   # "fixed" | "needs_context" | "failed"
    Imports                    : List[str] = Field(default_factory=list)
    RegionStart                : int       = 0
    RegionEnd                  : int       = 0
    ValidationPassed           : bool      = False
    ValidationError            : str       = ""
    SyntaxValidationAvailable  : bool      = False


# ── Finding (Vulnerability + Repair combined) ──────────────────────────────────

class VulnFinding(BaseModel):
    VulnName    : str
    Confidence  : float
    StartLine   : int
    EndLine     : int
    VulnLines   : List[int] = Field(default_factory=list)
    CodeSnippet : str
    Repair      : RepairInfo


# ── Scan Summary ───────────────────────────────────────────────────────────────

class ScanInfo(BaseModel):
    TotalChunks      : int
    VulnerableChunks : int


# ── Report Summary ─────────────────────────────────────────────────────────────

class ReportSummary(BaseModel):
    TotalVulnerabilities : int
    RepairedSuccessfully : int
    ModelsUsed           : List[str] = Field(default_factory=list)


# ── Final Report (Full API Response) ──────────────────────────────────────────

class VulnSneakReport(BaseModel):
    Filename         : str
    Status           : str          # "Safe" or "Vulnerable"
    Scan             : ScanInfo
    Findings         : List[VulnFinding] = Field(default_factory=list)
    Summary          : ReportSummary
    RepairedFile     : Optional[str] = None
    RepairedFilename : Optional[str] = None


# ── Health Check ───────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status       : str
    binary_model : str
    family_model : str
    ollama       : str
    validators   : Optional[dict] = None   # e.g. {"node": true, "python": true, ...}


# ── Chat ───────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role    : str
    content : str


class ChatRequest(BaseModel):
    message : str
    history : List[ChatMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    success    : bool
    response   : str
    model_used : str
    error      : Optional[str] = ""
