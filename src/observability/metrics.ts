import client from 'prom-client';

// Collect default Node.js and system metrics
client.collectDefaultMetrics({
  prefix: 'amrutam_',
});

export const metricsRegistry = client.register;

// Custom Metrics for Amrutam Telemedicine
export const httpRequestCounter = new client.Counter({
  name: 'amrutam_http_requests_total',
  help: 'Total number of HTTP requests processed',
  labelNames: ['method', 'route', 'status_code'],
});

export const httpRequestDurationHistogram = new client.Histogram({
  name: 'amrutam_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds (Monitored for p95 < 200ms read, < 500ms write SLA)',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 1, 2, 5],
});

export const activeConsultationsGauge = new client.Gauge({
  name: 'amrutam_active_consultations_current',
  help: 'Number of active consultations currently in progress',
});

export const bookingConflictsCounter = new client.Counter({
  name: 'amrutam_booking_conflicts_prevented_total',
  help: 'Total number of concurrent double-booking conflicts prevented by distributed locks',
});

export const idempotencyCacheHitsCounter = new client.Counter({
  name: 'amrutam_idempotency_cache_hits_total',
  help: 'Total number of idempotent write replays served safely from cache',
});

export const dbQueryDurationHistogram = new client.Histogram({
  name: 'amrutam_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'model'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});
