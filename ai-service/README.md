# VulnSneak — AI-Powered Vulnerability Detection & Automated Repair

VulnSneak is a graduation project that detects source code vulnerabilities using a fine-tuned **CodeBERT** two-stage pipeline and automatically repairs them using a cascade of LLMs.

> **AI pipeline developed by [Mohamed Khalid](https://github.com/MO-Khalid-1)** as part of a Computer Science graduation project.

---

## Features

- **Two-stage detection** — Binary classifier (safe vs. vulnerable) followed by an 8-family classifier
- **8 vulnerability families** — SQL Injection, XSS, CSRF, Path Traversal, OS Command Injection, Insecure Cryptography, Insecure Deserialization, XML Injection
- **Hybrid ML + rule-based confirmation** — reduces false positives
- **Region-based automated repair** — patches only the vulnerable region, not the full file
- **LLM repair cascade** — `qwen2.5-coder:7b` → `qwen3:4b` → `gemini-2.5-flash`
- **Syntax & security validation** before accepting any patch
- **Scoped cybersecurity chat assistant** — powered by the same LLM cascade

---

## Architecture

```
User uploads file
       │
       ▼
 ┌─────────────┐     Binary Model (CodeBERT)      ┌──────────────┐
 │  scanner.py │ ──────────────────────────────► │  Safe / Vuln │
 │             │     Family Model (CodeBERT)      └──────────────┘
 │             │ ──────────────────────────────► 8 Vulnerability Families
 └─────────────┘
       │  vulnerabilities list
       ▼
 ┌──────────────────┐
 │  repair_agent.py │  qwen2.5-coder:7b → qwen3:4b → gemini-2.5-flash
 │  (region-based)  │  syntax check + security validator + integrity check
 └──────────────────┘
       │  repaired file + full report
       ▼
    main.py (FastAPI)  ◄──── chat_agent.py (cybersecurity Q&A)
```

**Two-machine deployment:**
- **Machine 1 (Linux server):** FastAPI backend (`main.py`, `scanner.py`, `repair_agent.py`)
- **Machine 2 (Windows/GPU):** Ollama running `qwen2.5-coder:7b` and `qwen3:4b`, accessed via LAN IP or ngrok tunnel

---

## Models & Dataset

> ⚠️ The fine-tuned CodeBERT models are **not included in this repository** due to their size.  
> **The API will fail to start without them.** See setup step 3.

The fine-tuned CodeBERT models and a dataset sample are available on Kaggle:

- **Models:** [mokhalid1/vulnsneak-ai-models](https://www.kaggle.com/datasets/mokhalid1/vulnsneak-ai-models)
- **Dataset sample:** 2,400 stratified samples across all 8 vulnerability families (full dataset ~21,000+ pairs — sample only is published to keep the repository lightweight)

**Model performance:**
| Model | Metric | Score |
|-------|--------|-------|
| Binary Classifier | Vulnerable Recall | ~97.75% |
| Family Classifier | Macro F1 | ~99.80% |

> **Note:** Safe samples in the dataset are patched versions of vulnerable code, not natively safe code. This inflates test metrics relative to real-world performance.

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/MO-Khalid-1/vulnsneak.git
cd vulnsneak-api
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Download the models — required before running

Download from [Kaggle](https://www.kaggle.com/datasets/mokhalid1/vulnsneak-ai-models) and place them as:

```
vulnsneak_api/
├── models/
│   ├── binary_model/     ← fine-tuned binary CodeBERT checkpoint
│   └── family_model/     ← fine-tuned 8-family CodeBERT checkpoint
```

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
GEMINI_API_KEY=your_gemini_api_key_here
OLLAMA_URL=http://your-ollama-machine:11434
BINARY_MODEL_PATH=./models/binary_model
FAMILY_MODEL_PATH=./models/family_model
```

### 5. Run the API

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## API Endpoints

### `GET /health`
Check that all services (models, Ollama, validators) are running.

### `POST /analyze`
Upload a source file for vulnerability detection and automated repair.

**Request:** `multipart/form-data` with a `file` field

**Supported extensions:** `.py` `.java` `.js` `.ts` `.jsx` `.tsx` `.php` `.cs` `.cpp` `.c` `.html` `.xml` `.jsp` `.aspx` `.rb` `.go`

**Response:**
```json
{
  "Filename": "example.js",
  "Status": "Vulnerable",
  "Scan": { "TotalChunks": 12, "VulnerableChunks": 3 },
  "Findings": [...],
  "Summary": { "TotalVulnerabilities": 2, "RepairedSuccessfully": 2, "ModelsUsed": ["qwen2.5-coder:7b"] },
  "RepairedFile": "...",
  "RepairedFilename": "example_repaired.js"
}
```

### `POST /chat`
Ask the scoped cybersecurity assistant a question.

**Request:**
```json
{
  "message": "What is SQL Injection?",
  "history": []
}
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Detection | CodeBERT (`microsoft/codebert-base`), fine-tuned on ~21K samples |
| Repair LLMs | Ollama (`qwen2.5-coder:7b`, `qwen3:4b`), Gemini 2.5 Flash |
| Backend | FastAPI, Python 3.11 |
| Training | Google Colab (A100) |

---

## Project Structure

```
vulnsneak_api/
├── main.py           # FastAPI app — endpoints and pipeline orchestration
├── scanner.py        # Two-stage CodeBERT detection pipeline
├── repair_agent.py   # Region-based LLM repair with validation
├── chat_agent.py     # Scoped cybersecurity chat assistant
├── config.py         # All settings (loaded from environment variables)
├── models.py         # Pydantic schemas for API requests/responses
├── requirements.txt
├── .env.example      # Environment variable template
└── .gitignore
```

---

## Author

**Mohamed Khalid** — AI pipeline (detection, repair, chat)
[GitHub](https://github.com/MO-Khalid-1) · [Kaggle](https://www.kaggle.com/mokhalid1)

---

## License

This project was developed as a graduation project. Model weights and dataset are provided for research and educational use.
