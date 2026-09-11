import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import redis from './db.js';
import { getBookById } from './grpcClient.js';
import { startGrpcServer } from './grpcServer.js';
dotenv.config();

const COMM_MODE = process.env.COMM_MODE || 'rest';
console.log(`Cart service communication mode: ${COMM_MODE}`);

const app = express();
app.use(cors());
app.use(express.json());

const cartKey = (userId) => `cart:${userId}`;

app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.json({ status: 'Ok', service: 'cart-service' });
  } catch (err) {
    res.status(503).json({ status: 'Unavailable', service: 'cart-service' });
  }
});

app.get('/api/cart/:userId', async (req, res) => {
  try {
    const data = await redis.hgetall(cartKey(req.params.userId));
    const items = Object.entries(data || {}).map(([book_id, quantity]) => ({
      book_id, quantity: parseInt(quantity, 10),
    }));
    res.json({ userId: req.params.userId, items });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/cart/:userId', async (req, res) => {
  const { userId } = req.params;
  const { book_id, quantity } = req.body;
  try {
    if (COMM_MODE === 'grpc') {
      const book = await getBookById(book_id);
      if (!book.found) return res.status(404).json({ message: 'Book not found in catalog' });
    } else {
      const catalogUrl = process.env.CATALOG_URL || 'http://catalog_service:5001';
      const response = await fetch(`${catalogUrl}/api/books/${book_id}`);
      if (!response.ok) return res.status(404).json({ message: 'Book not found in catalog' });
    }
    await redis.hincrby(cartKey(userId), book_id, Number(quantity) || 1);
    const data = await redis.hgetall(cartKey(userId));
    const cart = Object.entries(data).map(([id, qty]) => ({
      book_id: id, quantity: parseInt(qty, 10),
    }));
    res.json({ message: 'Added to cart', cart });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ message: 'Error updating cart' });
  }
});

app.delete('/api/cart/:userId/:bookId', async (req, res) => {
  const { userId, bookId } = req.params;
  try {
    await redis.hdel(cartKey(userId), bookId);
    const data = await redis.hgetall(cartKey(userId));
    const cart = Object.entries(data || {}).map(([id, qty]) => ({
      book_id: id, quantity: parseInt(qty, 10),
    }));
    res.json({ message: 'Removed from cart', cart });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cart service (REST) running on port ${PORT}`);
  startGrpcServer();
});
