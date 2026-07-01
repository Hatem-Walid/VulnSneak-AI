# Dataset Documentation

> AI Training Dataset for Web Application Vulnerability Detection

---

# Overview

The VulnSneak dataset was created to support AI-assisted detection of web application vulnerabilities.

Instead of collecting vulnerable code from a single source, the dataset was generated using a controlled generation pipeline with multiple quality assurance stages to maximize diversity, consistency, and security correctness.

Each sample contains both:

- Vulnerable source code
- Secure repaired version

This allows the dataset to be used for:

- Vulnerability Detection
- Vulnerability Classification
- Secure Code Repair
- Transformer Fine-tuning
- Security Research

---

# Dataset Objectives

The dataset was designed to:

- Improve vulnerability detection accuracy.
- Increase dataset diversity.
- Reduce duplicated samples.
- Generate realistic business scenarios.
- Produce high-quality secure code examples.
- Support transformer-based AI models.

---

# Supported Vulnerabilities

The dataset currently supports the following vulnerability classes:

| Vulnerability | Description |
|---------------|-------------|
| SQL Injection | Unsanitized SQL queries |
| Cross-Site Scripting (XSS) | Client-side script injection |
| Cross-Site Request Forgery (CSRF) | Unauthorized request execution |
| XML Injection | XXE, XPath, SOAP, XSLT attacks |
| Path Traversal | Unauthorized file access |
| OS Command Injection | Operating system command execution |
| Insecure Deserialization | Unsafe object deserialization |
| Insecure Cryptography | Weak or insecure cryptographic implementations |

---

# Dataset Structure

Each vulnerability has its own generator script and output dataset.

Example:

```
datasets/

├── sqli_output.jsonl

├── xss_output.jsonl

├── csrf_output.jsonl

├── xml_output.jsonl

├── path_traversal_output.jsonl

├── command_injection_output.jsonl

├── deserialization_output.jsonl

└── cryptography_output.jsonl
```

---

# JSONL Format

Each line represents one training sample.

Example:

```json
{
    "vuln_code": "...",
    "state": "SQL Injection",
    "safe_code": "...",
    "safe_code_label": "Safe"
}
```

---

# Sample Fields

| Field | Description |
|--------|-------------|
| vuln_code | Vulnerable source code |
| state | Vulnerability type |
| safe_code | Secure repaired version |
| safe_code_label | Fixed code label |

---

# Dataset Generation Workflow

The generation pipeline follows these stages:

```
Prompt Engineering

↓

LLM Generation

↓

Parsing

↓

Validation

↓

Mitigation Verification

↓

Duplicate Detection

↓

Quality Checks

↓

Dataset Export
```

---

# Dataset Validation

Every generated sample passes several validation stages before being accepted.

Validation includes:

- Output format validation
- Vulnerability verification
- Security mitigation verification
- Dataset consistency checks
- Duplicate detection
- Token budget verification

Only validated samples are included in the final dataset.

---

# Diversity Strategy

The dataset generation pipeline improves diversity by varying:

- Programming languages
- Frameworks
- Vulnerability subtypes
- Business domains
- Database schemas
- Application scenarios

This reduces overfitting and improves generalization.

---

# Supported Programming Languages

Generated samples cover multiple languages including:

- Python
- Java
- JavaScript
- PHP
- C#
- Go
- Ruby
- Kotlin

Frameworks vary depending on the vulnerability class.

---

# Dataset Quality Assurance

Several quality mechanisms are implemented during generation.

These include:

- Near-duplicate detection
- Prompt constraints
- Security validation
- Token budgeting
- Business context rotation
- Automatic checkpoint recovery
- Parallel generation
- Dataset consistency verification

---

# Intended AI Models

The dataset was primarily designed for transformer-based models such as:

- CodeBERT
- RoBERTa-based code models
- Fine-tuned vulnerability classifiers

The generated vulnerable/safe pairs can also support future research in AI-assisted code repair.

---

# Repository Organization

```
datasets/

├── Vulnerability Outputs

├── Generator Scripts

├── Validation Pipeline

└── Documentation
```

---

# Limitations

Although significant effort was made to improve dataset quality, several limitations remain.

Examples include:

- Generated samples are synthetic.
- Additional validation using real-world vulnerable code is recommended.
- Future versions should incorporate CVE-based examples.
- Continuous evaluation is required as AI models evolve.

---

# Future Work

Future improvements may include:

- CVE integration
- Larger multilingual datasets
- Automated benchmark generation
- Multi-model validation
- Dataset versioning
- Continuous dataset updates

---

# Summary

The VulnSneak dataset emphasizes quality, diversity, and security correctness rather than raw sample quantity.

Through prompt engineering, validation, duplicate detection, and structured quality assurance, the dataset provides a strong foundation for AI-assisted vulnerability detection and secure code generation research.