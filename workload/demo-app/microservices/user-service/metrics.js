// Prometheus instrumentation shared by every MyBookstore microservice.
// Metric names, labels and buckets intentionally mirror catalog-service so the
// Hypo backend can query every service with the same PromQL (job="<service>").
import client from 'prom-client';

export function installMetrics(app) {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });

  const httpRequestsTotal = new client.Counter({
    name: 'http_requests_total',
    help: 'How many HTTP requests the service has received',
    labelNames: ['method', 'status'],
    registers: [register],
  });

  const httpRequestDurationSeconds = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'How long each HTTP request takes, in seconds',
    labelNames: ['method', 'status'],
    buckets: [0.05, 0.1, 0.3, 0.5, 1, 2],
    registers: [register],
  });

  app.use((req, res, next) => {
    if (req.path === '/metrics') return next();
    const endTimer = httpRequestDurationSeconds.startTimer();
    res.on('finish', () => {
      const labels = { method: req.method, status: String(res.statusCode) };
      httpRequestsTotal.inc(labels);
      endTimer(labels);
    });
    next();
  });

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
}
