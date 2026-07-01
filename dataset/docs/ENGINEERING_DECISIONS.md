# Engineering Decisions

> Why the VulnSneak dataset generation pipeline was designed the way it is.

---

# Introduction

Generating high-quality cybersecurity datasets is significantly more challenging than simply asking a Large Language Model (LLM) to produce vulnerable code.

Early experiments showed that naive prompt-based generation resulted in:

- Large numbers of duplicated samples.
- Low diversity.
- Incorrect vulnerability labels.
- Weak security fixes.
- Excessively long code samples.
- Unrealistic business scenarios.

The engineering decisions documented below were introduced to solve these problems while creating a dataset suitable for fine-tuning transformer-based vulnerability detection models.

---

# Design Philosophy

The primary objective was not generating more samples.

The objective was generating **better samples**.

Every engineering decision was evaluated based on:

- Dataset Quality
- Diversity
- Consistency
- Security Correctness
- AI Training Effectiveness

---

# 1. Prompt Engineering

## Why?

Simple prompts consistently produced repetitive code with minimal diversity.

Examples often differed only by:

- Variable names
- Function names
- Table names

while representing nearly identical vulnerabilities.

## Solution

Each generator script uses carefully engineered prompts containing:

- Explicit vulnerability subtype
- Programming language
- Framework
- Business context
- Security constraints
- Formatting rules
- Dataset quality rules

This forces the model to generate meaningful variations instead of superficial changes.

---

# 2. Near-Duplicate Detection

## Problem

Large Language Models naturally repeat similar outputs.

Traditional duplicate removal only detects exact matches.

Near-identical samples remained.

Example:

```
query = "SELECT * FROM users WHERE id=" + user_id
```

and

```
query = "SELECT * FROM accounts WHERE id=" + account_id
```

These are almost identical for model training.

## Solution

A sliding N-Gram fingerprint combined with Jaccard Similarity is used.

Pipeline:

Code

↓

Tokenization

↓

4-Gram Fingerprint

↓

Jaccard Comparison

↓

Reject Near Duplicate

This dramatically improves dataset diversity while remaining computationally inexpensive.

---

# 3. Dataset Diversity

## Problem

Without constraints, LLMs repeatedly generate:

- Login systems
- User tables
- Flask examples

This creates strong dataset bias.

## Solution

The generators rotate across:

- Programming languages
- Frameworks
- Business domains
- Database tables
- Vulnerability subtypes

The result is significantly broader coverage of realistic software environments.

---

# 4. Business Context Rotation

Real-world vulnerabilities occur in many different systems.

Examples include:

- Healthcare
- Banking
- E-Commerce
- HR Systems
- Inventory Management
- Logistics
- Education
- Booking Platforms

Each context introduces different entities and database structures.

This reduces semantic duplication and improves model generalization.

---

# 5. Token Budget Optimization

The detection model is based on CodeBERT.

CodeBERT has a maximum context window of 512 tokens.

Long samples would be truncated during training.

To prevent information loss:

- Character limits were introduced.
- Estimated WordPiece token counts were calculated.
- Automatic truncation preserved syntactic validity.

This ensured every accepted sample fit within the model's context window.

---

# 6. Validation Pipeline

Generated samples pass through multiple validation stages before acceptance.

These include:

- Format validation
- Vulnerability verification
- Security mitigation verification
- Duplicate detection
- Token budget validation
- Dataset consistency checks

Only samples passing every stage are written to the dataset.

---

# 7. Security Mitigation Verification

A generated "safe" example is only useful if it actually fixes the vulnerability.

Instead of trusting the LLM output, every generator verifies that:

- The vulnerable pattern exists.
- The mitigation exists.
- Unsafe APIs were removed.
- Secure APIs were introduced.

This significantly reduces false-positive safe samples.

---

# 8. Checkpoint Recovery

Generating thousands of samples may require several hours.

Interruptions should not require restarting the entire generation process.

Checkpoint files periodically save accepted samples.

Generation can resume from the last checkpoint at any time.

---

# 9. Parallel Generation

Several generators support multiple API keys running concurrently.

Advantages include:

- Higher throughput
- Reduced idle time
- Better API utilization

Parallel generation significantly decreases total dataset creation time.

---

# 10. Modular Design

Shared logic was extracted into reusable utility modules.

Examples include:

- Text processing
- Duplicate detection
- Configuration
- Logging

This improves maintainability while allowing each vulnerability generator to focus only on vulnerability-specific logic.

---

# Lessons Learned

Developing the dataset generation pipeline revealed several important observations.

- Larger datasets are not necessarily better.
- Dataset diversity is more valuable than dataset size.
- Security validation should never rely solely on LLM outputs.
- Engineering quality has a direct impact on AI model quality.

---

# Future Improvements

Potential future enhancements include:

- Real-world CVE integration
- Multi-model dataset generation
- Automatic evaluation metrics
- Semantic similarity detection using embeddings
- Active learning pipelines
- Continuous dataset validation

---

# Conclusion

The VulnSneak dataset generation pipeline was designed to prioritize dataset quality over dataset quantity.

Rather than relying solely on prompt engineering, the pipeline combines validation, duplicate detection, diversity enforcement, security verification, and engineering best practices to create reliable datasets suitable for AI-assisted vulnerability detection research.