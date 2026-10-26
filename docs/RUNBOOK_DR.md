# Amrutam Telemedicine — Disaster Recovery & Backup Runbook

## 1. Objectives & SLAs
* **RPO (Recovery Point Objective):** < 5 Minutes (Maximum tolerable data loss)
* **RTO (Recovery Time Objective):** < 15 Minutes (Maximum tolerable downtime)
* **Target Availability:** 99.95%

---

## 2. Automated Backup Strategy

### 2.1 PostgreSQL Automated Snapshots & WAL Archiving
1. **Continuous WAL Archival:**
   * PostgreSQL Write-Ahead Logs (WAL) are streamed to Amazon S3 every 60 seconds with server-side encryption (`aws:kms`).
   * Provides Point-In-Time-Recovery (PITR) down to the exact second within a 35-day retention window.
2. **Automated Daily Snapshots:**
   * Full database snapshots trigger daily at 02:00 AM IST (low-traffic window).
   * Retention: 30 daily snapshots, 12 monthly snapshots.
3. **Cross-Region Replication:**
   * Snapshots are asynchronously replicated to secondary region (`ap-southeast-1` Singapore) within 15 minutes of completion.

### 2.2 Redis In-Memory Persistence
* **AOF (Append Only File):** Set to `fsync everysec` for durable distributed lock retention and cached state recovery.
* **RDB Snapshots:** Captured every 15 minutes.

---

## 3. Incident Severity Levels

| Severity | Definition | Example | Target Response | Target Resolution |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Entire platform down or data integrity breached | Primary PostgreSQL unreachable, double bookings occurring | Immediate (< 5 min) | < 15 min |
| **SEV-2 (High)** | Core workflow impaired | Payment webhook failing, video token generation timing out | < 15 min | < 1 hour |
| **SEV-3 (Medium)** | Non-critical feature down | Admin analytics slow, prescription PDF delayed | < 1 hour | < 4 hours |

---

## 4. Disaster Recovery Scenarios & Step-by-Step Procedures

### Scenario A: Primary PostgreSQL AZ Failure (Automatic Failover)
* **Symptom:** API Gateway reports 500 errors on database writes; RDS health status changes to `failing-over`.
* **Standard Operational Procedure:**
  1. AWS RDS Multi-AZ automatically detects loss of primary instance heartbeat (< 30 seconds).
  2. Standby replica in AZ-b is promoted to Master.
  3. RDS DNS CNAME flips to the new master IP (< 60 seconds).
  4. Amrutam backend connection pool automatically reconnects with exponential backoff.
  5. **Verification Command:**
     ```bash
     npm run test:dr-healthcheck
     ```
  6. Confirm write latency p95 returns to < 500ms via Grafana dashboard.

### Scenario B: Complete Cloud Region Outage (Cross-Region Failover)
* **Symptom:** Primary AWS region `ap-south-1` is completely dark.
* **Standard Operational Procedure:**
  1. Incident Commander declares SEV-1 and authorizes DR activation.
  2. **Terraform Secondary Region Spin-up:**
     ```bash
     cd infra/terraform
     terraform workspace select dr-singapore
     terraform apply -var="restore_snapshot_id=latest" -auto-approve
     ```
  3. Restore PostgreSQL from latest cross-region replicated snapshot (Time elapsed: ~8 minutes).
  4. Spin up ECS/Fargate container tasks running `amrutam-telemedicine-backend:latest`.
  5. Route 53 DNS Failover Record flips traffic from Mumbai to Singapore endpoint.
  6. Verify `/health/readiness` returns `200 OK`.
  7. Total RTO achieved: ~12.5 minutes (within 15-minute SLA).

### Scenario C: Corrupted Booking or Concurrency Anomaly Recovery
* **Symptom:** Inconsistent slot reservation state detected.
* **Standard Operational Procedure:**
  1. Run the Slot Integrity Reconciler:
     ```sql
     -- Reclaim orphaned slots where reservation held longer than 10 mins without payment
     UPDATE availability_slots 
     SET status = 'AVAILABLE', locked_until = NULL, locked_by_user_id = NULL
     WHERE status = 'RESERVED' 
       AND locked_until < NOW();
     ```
  2. Clear Redis slot cache:
     ```bash
     redis-cli EVAL "return redis.call('del', unpack(redis.call('keys', 'cache:slots:*')))" 0
     ```
  3. Verify audit trail for affected consultations:
     ```sql
     SELECT * FROM audit_logs WHERE action IN ('CONSULTATION_RESERVED', 'PAYMENT_EXPIRED') ORDER BY created_at DESC LIMIT 50;
     ```
