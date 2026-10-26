# Amrutam Telemedicine System — Security Checklist & Threat Model

This document outlines the end-to-end security posture, STRIDE threat model, OWASP Top 10 mitigations, data classification, cryptographic policies, and audit compliance for Amrutam's Telemedicine Backend.

---

## 1. Attack Surface Analysis

The Amrutam Telemedicine Backend exposes three main attack surfaces:
1. **Public Edge & Internet Ingress:**
   * User authentication endpoints (`/api/v1/auth/*`)
   * Doctor directory & availability search (`/api/v1/doctors/*`)
   * Payment webhook receiver endpoints (`/api/v1/payments/webhook`)
2. **Authenticated Application APIs:**
   * Booking reservation & consultation lifecycle (`/api/v1/bookings`, `/api/v1/consultations`)
   * Protected Health Information (PHI) & Ayurvedic prescriptions (`/api/v1/consultations/:id/prescriptions`)
   * Teleconsultation video tokens & communication channels
3. **Internal & Management Surfaces:**
   * Admin analytics & financial metrics (`/api/v1/admin/*`)
   * Prometheus metrics endpoint (`/metrics`) and Kubernetes health checks (`/health/*`)
   * Database & Redis connection pool strings

---

## 2. STRIDE Threat Model & Mitigations

| Category | Threat Description | Affected Component | Implemented Mitigation |
| :--- | :--- | :--- | :--- |
| **Spoofing** | Attacker impersonates a doctor or patient using forged JWTs or brute-forcing passwords. | Auth Service, JWT Middleware | • Argon2/Bcrypt password hashing with salt factor 12.<br>• Short-lived JWT Access Tokens (15-60m) with cryptographically random Refresh Tokens.<br>• Mandatory Multi-Factor Authentication (TOTP via RFC 6238) for Doctor & Admin roles.<br>• Secure, HTTP-only, SameSite cookies for web clients. |
| **Tampering** | Man-in-the-middle or malicious patient altering prescription dosages or payment webhook amounts. | Consultations, Payments, Audit Logs | • TLS 1.3 enforced for all transport connections.<br>• Payment webhooks validated using HMAC-SHA256 signature verification with secret keys.<br>• Prescriptions signed digitally with cryptographic checksums.<br>• Immutable Audit Logs with cryptographic SHA-256 tamper-evident hash chaining. |
| **Repudiation** | Doctor denies issuing a prescription, or patient denies booking a slot. | Prescriptions, Bookings | • Every state change logs an append-only entry in `audit_logs` capturing `user_id`, `ip_address`, `user_agent`, `timestamp`, `previous_state`, and `new_state`.<br>• Audit trail entries cannot be updated or deleted by application users. |
| **Information Disclosure** | Leakage of patient medical history, Ayurvedic diagnosis, or payment credentials. | Database, Network, Logs | • Field-Level Encryption (AES-256-GCM) for sensitive PHI (Prescription private notes, medical diagnosis).<br>• Zero-PII logging policy: Pino logger scrubs passwords, tokens, and credit card numbers.<br>• Strict CORS headers and Helmet security headers preventing browser sniffing. |
| **Denial of Service** | Flooding booking endpoints during high-demand campaigns (100k daily consultations). | API Gateway, Booking Engine | • Multi-tier Rate Limiting (Redis sliding window / token bucket): 100 req/min per IP on public endpoints, 20 req/min on auth endpoints.<br>• Distributed lock with fast-fail response (409 Conflict) preventing thread pool starvation.<br>• Strict payload size limits (max 100kb for JSON payloads). |
| **Elevation of Privilege** | Normal patient invokes admin analytics or accesses another patient's medical records (BOLA / IDOR). | All Modules, RBAC Middleware | • Granular Role-Based Access Control (`PATIENT`, `DOCTOR`, `ADMIN`).<br>• Object-Level Authorization: Middleware validates that `req.user.id` matches the consultation `patient_id` or `doctor_id` before granting access. |

---

## 3. OWASP Top 10 (API Security) Mitigation Matrix

| OWASP Vulnerability | Risk | Amrutam Engineering Defense |
| :--- | :--- | :--- |
| **API1: Broken Object Level Auth (BOLA)** | Patient A requests `/consultations/{patient_B_id}` | Strict ownership check in repository/service layer: `WHERE id = :id AND (patient_id = :userId OR doctor_id = :userId OR role = 'ADMIN')`. |
| **API2: Broken Authentication** | Credential stuffing, weak tokens | Rate limiting on `/auth/login` (5 attempts per 15 min per IP), TOTP MFA enforcement, high-entropy secrets (min 32 bytes). |
| **API3: Broken Object Property Level Auth** | Patient submits `status: "COMPLETED"` during booking | Zod schema validation strips non-whitelisted fields (Mass Assignment protection). Only doctors can patch consultation status to COMPLETED. |
| **API4: Unrestricted Resource Consumption** | Slowloris or heavy search requests | Pagination forced on all collection endpoints (`limit` max 50), timeout set on all DB queries (max 3000ms), Redis caching for search queries. |
| **API5: Broken Function Level Auth (BFLA)** | Patient accessing `/api/v1/admin/analytics` | `requireRole(['ADMIN'])` middleware validates user role from cryptographically verified token claims before entering route handlers. |
| **API6: Server-Side Request Forgery (SSRF)** | Fetching arbitrary external URLs | Telemedicine platform does not accept arbitrary external URLs. Webhook endpoints only accept inbound traffic from verified IP ranges. |
| **API7: Security Misconfiguration** | Verbose error stack traces in production | Centralized error handler masks internal DB errors. In production, only standard error code and message are returned. Helmet enables HSTS, X-Content-Type-Options: nosniff. |
| **API8: Lack of Protection from Automated Threats** | Bots reserving all doctor slots | Idempotency key requirement (`X-Idempotency-Key`), CAPTCHA trigger on suspicious burst traffic, user account verification before booking. |
| **API9: Improper Inventory Management** | Shadow APIs or unmaintained v0 endpoints | OpenAPI 3.0 schema strictly synchronized with route controllers. Deprecated endpoints return HTTP 410 Gone. |
| **API10: Unsafe Consumption of APIs** | Blind trust in payment gateway payload | Gateway webhooks verified via HMAC-SHA256 signature, payload deserialized and strictly validated with Zod before processing. |

---

## 4. Data Classification & Privacy (PHI / HIPAA-Ready)

| Classification Level | Data Elements | Storage & Handling Policy |
| :--- | :--- | :--- |
| **Public** | Doctor names, specialties, clinic hours, bio, consultation fee | Plaintext in PostgreSQL, cached in Redis L1, CDN cacheable. |
| **Internal** | User IDs, timestamps, slot IDs, aggregated analytics | Plaintext in PostgreSQL, TLS in transit, restricted to authenticated services. |
| **Confidential / PII** | Patient email, phone number, address, date of birth | Encrypted in transit (TLS 1.3), hashed indexing for lookups, masked in logs. |
| **Restricted / PHI** | Ayurvedic medical diagnosis, doctor private clinical notes, prescription medicines, dosage | **Encrypted at rest using AES-256-GCM** with unique initialization vectors (IV). Decrypted only in memory when accessed by authorized doctor/patient. Never logged. |

---

## 5. Cryptographic Architecture & Key Rotation

1. **Symmetric Encryption (AES-256-GCM):**
   * Algorithm: `aes-256-gcm` with authenticated tag verification to prevent cipher-text tampering.
   * Format: `iv:authTag:encryptedData` (Base64 encoded).
2. **Key Rotation Lifecycle:**
   * Encryption keys are versioned (e.g., `KEY_V1`, `KEY_V2`).
   * Active writes use the current primary key version.
   * Reads inspect the key version prefix; if encrypted with an older version, the service decrypts with the legacy key and re-encrypts with the latest active key during read/write cycles (Lazy Re-encryption).
   * Master secrets stored in AWS Secrets Manager / Vault with automated 90-day rotation.

---

## 6. Audit Trail & Compliance Checklist

* [x] **Immutable Storage:** Audit logs are append-only. No `UPDATE` or `DELETE` permissions granted to the application user on `audit_logs` table.
* [x] **Cryptographic Hash Chain:** Each audit log contains `tamper_hash = SHA256(previous_hash + user_id + action + timestamp + payload)` to prove the chain has not been tampered with.
* [x] **Audit Scope:** Logs record:
  * Authentication events (login, failed login, MFA challenge)
  * Booking creations, cancellations, and status modifications
  * Prescription creations and PHI viewing events
  * Admin role changes and security updates
* [x] **Automated Dependency Scanning:** CI pipeline incorporates `npm audit` and Trivy vulnerability scanners to halt deployment on high/critical CVEs.
