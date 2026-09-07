import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bookRoutes from './routes/bookRoutes.js';
import connectDB from './config/db.js';
import { startGrpcServer } from './grpcServer.js';
import { seedBooks } from './models/Book.js';  // ← agregar
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => res.json({ status: 'Ok', service: 'catalog-service' }));
app.use('/api/books', bookRoutes);

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5001;
connectDB().then(async () => {       // ← async
  await seedBooks();                 // ← seed DESPUÉS de conectar
  app.listen(PORT, () => console.log(`Catalog service (REST) running on port ${PORT}`));
  startGrpcServer();
});