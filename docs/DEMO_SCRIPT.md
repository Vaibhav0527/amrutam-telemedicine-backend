# Amrutam Telemedicine System — 5-Minute Video Walkthrough Script

This script outlines the exact structure, timing, and talking points for the 5-minute submission video.

---

## ⏱️ Video Timeline (Total: 5 Minutes)

| Timestamp | Section | Key Visuals | Key Talking Points |
| :--- | :--- | :--- | :--- |
| **0:00 – 0:45** | **Introduction & Architecture Overview** | Architecture diagram in `docs/ARCHITECTURE.md`, Swagger API docs UI | • Introduce Amrutam Telemedicine backend.<br>• Target: 100k daily consultations, p95 < 200ms read, < 500ms write, 99.95% uptime.<br>• Modular Clean Architecture with TypeScript, PostgreSQL, Prisma, Redis, Prometheus. |
| **0:45 – 1:30** | **Authentication, RBAC & MFA Setup** | Terminal / Postman test of `/api/v1/auth/register`, `/mfa/setup`, `/mfa/verify` | • Show registration for Patient & Doctor.<br>• Demonstrate TOTP-based Multi-Factor Authentication with QR code & secret token verification.<br>• Demonstrate RBAC enforcement (Patient cannot access Doctor or Admin endpoints). |
| **1:30 – 2:30** | **Doctor Availability & Concurrency Lock Demo (Zero Double-Booking)** | Parallel booking script running 2 concurrent requests on the same slot | • Show doctor creating recurring slots.<br>• Demonstrate two simultaneous booking requests hitting the same slot.<br>• Show Redis Redlock + PostgreSQL `SELECT FOR UPDATE` allowing only 1 booking and rejecting the second with `409 Conflict`. Zero double-booking guaranteed! |
| **2:30 – 3:15** | **Consultation Lifecycle, Prescriptions & PHI Encryption** | Postman / API test completing consultation & creating prescription | • Demonstrate consultation state machine (`PENDING_PAYMENT` $\rightarrow$ `SCHEDULED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`).<br>• Show creation of Ayurvedic prescription (medicines, dosage, dietary advice).<br>• Highlight AES-256-GCM encryption of private clinical notes in DB. |
| **3:15 – 4:00** | **Idempotency & Resilience (Bonus Deliverable)** | Replaying same `X-Idempotency-Key` write request | • Send booking request with `X-Idempotency-Key: amrutam-tx-101`.<br>• Replay the same request — show system returns atomic cached response without duplicate DB insert or double charging. |
| **4:00 – 4:40** | **Observability & Audit Trails** | Prometheus metrics at `/metrics`, Health checks at `/health/readiness`, Audit log queries | • Show live Prometheus metrics (HTTP request counter, latency histograms, active consultations).<br>• Show structured JSON logs with `X-Request-Id` correlation tracing.<br>• Show immutable audit log entry with tamper-evident SHA-256 hash chaining. |
| **4:40 – 5:00** | **CI/CD, Docker & Summary** | `docker-compose.yml`, GitHub Actions workflow file, test suite run | • Run `npm test` showing 100% passing tests.<br>• Point to Docker containerization and CI pipeline.<br>• Wrap up and thank the evaluator. |
