import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import client from 'prom-client';
import bookRoutes from './routes/bookRoutes.js';
import connectDB from './config/db.js';
import { startGrpcServer } from './grpcServer.js';
import { seedBooks } from './models/Book.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

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

app.get('/health', (req, res) => res.json({ status: 'Ok', service: 'catalog-service' }));
app.get('/', (req, res) => res.json({ status: 'Ok', service: 'catalog-service' }));
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
app.use('/api/books', bookRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5001;
connectDB().then(async () => {
  await seedBooks();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Catalog service (REST) running on port ${PORT}`);
    startGrpcServer();
  });
});
