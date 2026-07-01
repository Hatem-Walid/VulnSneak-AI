# 📊 VulnSneak — Dataset

generators/     → Dataset generation scripts
utils/          → Shared helper modules
samples/        → Representative JSONL examples
docs/           → Technical documentation

> AI Dataset Engineering for AI-Assisted Web Application Vulnerability Detection

![Python](https://img.shields.io/badge/Python-3.10+-blue)
![Dataset](https://img.shields.io/badge/Format-JSONL-orange)
![OWASP](https://img.shields.io/badge/OWASP-Top%2010-red)
![Classes](https://img.shields.io/badge/Vulnerabilities-8-success)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Overview

This directory contains the dataset engineering components of **VulnSneak**, including the dataset schema, representative samples, and synthetic generation pipeline used to create training data for the project's AI models.

The generated datasets support:

- Binary Vulnerability Detection
- Multi-Class Vulnerability Classification (8 Classes)
- AI-Assisted Secure Code Repair

The dataset generation pipeline emphasizes **quality, diversity, consistency, and security correctness** rather than simply producing a large number of samples.

Part of the **VulnSneak** Graduation Project  
Faculty of Science — Zagazig University (2025–2026).

---

# Dataset Statistics

| Item | Value |
|------|------:|
| Vulnerability Classes | 8 |
| Generator Scripts | 8 |
| Dataset Format | JSONL |
| Programming Languages | 8+ |
| Duplicate Detection | ✔ |
| Quality Validation | ✔ |
| Prompt Engineering | ✔ |
| Security Verification | ✔ |

---

# Directory Structure

```text
dataset/
│
├── README.md
├── schema.json
│
├── samples/
│   ├── sample_sqli.jsonl
│   ├── sample_xss.jsonl
│   ├── sample_csrf.jsonl
│   ├── sample_path.jsonl
│   └── sample_deserialization.jsonl
│
├── generators/
│   ├── generate_sqli.py
│   ├── generate_xss.py
│   ├── generate_csrf.py
│   ├── generate_xml.py
│   ├── generate_path.py
│   ├── generate_crypto.py
│   ├── generate_command.py
│   └── generate_deserialization.py
│
├── utils/
│
├── requirements.txt
├── pyproject.toml
├── .env.example
└── LICENSE
```

---

# Supported Vulnerability Classes

- SQL Injection (SQLi)
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- XML Injection
- Path Traversal
- OS Command Injection
- Insecure Deserialization
- Insecure Cryptography

Each vulnerability class has a dedicated generator responsible for producing labeled vulnerable/secure code pairs following the schema defined in `schema.json`.

---

# Supported Programming Languages

The generated dataset includes realistic code samples across multiple programming languages and frameworks, including:

- Python
- Java
- JavaScript
- PHP
- C#
- Go
- Ruby
- Kotlin

This diversity improves model generalization across different software ecosystems.

---

# Dataset Schema

Samples are stored as **JSONL** (JSON Lines).

Each record follows the schema defined in `schema.json`.

Typical fields include:

- Vulnerable Source Code
- Vulnerability Type
- Binary Detection Label
- Multi-Class Vulnerability Label
- Vulnerable Line Range
- Secure Repaired Code

Representative examples are available under the `samples/` directory.

---

# Dataset Generation Pipeline

```
Prompt Engineering

↓

LLM Generation

↓

Output Parsing

↓

Validation

↓

Security Verification

↓

Near-Duplicate Detection

↓

Quality Assurance

↓

JSONL Export
```

---

# Quality Assurance

The generation pipeline applies multiple quality-control stages before accepting any generated sample.

These include:

- Prompt Engineering
- Dataset Validation
- Near-Duplicate Detection
- Security Mitigation Verification
- Token Budget Optimization
- Context Diversity
- Business Scenario Rotation
- Automatic Checkpoint Recovery
- Parallel Dataset Generation

---

# Why JSONL?

JSONL was selected because it:

- Supports streaming large datasets
- Is compatible with Hugging Face datasets
- Is simple to process using Python
- Scales efficiently for AI pipelines

---

# Generating New Samples

1. Install dependencies

```bash
pip install -r requirements.txt
```

2. Configure the environment

```bash
cp .env.example .env
```

3. Run a generator

```bash
python generators/generate_sqli.py
```

Each generator targets a specific vulnerability class and produces labeled samples compatible with the project schema.

---

# External Training Sources

The complete training dataset also integrates publicly available security datasets.

Examples include:

- Vulnerable Programming Dataset (Hugging Face)
- Code Vulnerability Security DPO (Hugging Face)
- Vulnerability Fix Dataset (Kaggle)
- Code Vulnerabilities Dataset (Kaggle)
- SQL Injection Dataset (Kaggle)
- VulnSneak Final Dataset (Kaggle)

Labels are aligned with:

- OWASP Top 10
- MITRE CWE

Large datasets are intentionally hosted externally rather than inside Git.

Only representative samples, schemas, and generation code are maintained in this repository.

---

# Design Principles

The dataset engineering process follows five core principles:

- Quality over Quantity
- Diversity First
- Security Correctness
- Reproducibility
- Maintainability

---

# Disclaimer

The vulnerable code contained in this repository is intended exclusively for:

- AI Training
- Cybersecurity Research
- Educational Purposes

It must **never** be used in production systems.

---

# Related Documentation

Additional documentation is available in the `docs/` directory:

- Architecture
- Dataset Documentation
- Engineering Decisions
- Project Structure

---

# Citation

If this dataset contributes to your research or educational work, please cite the VulnSneak project.

---

For the complete system architecture and AI workflow, see the project's root README.