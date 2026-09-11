import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import redis from './db.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res) => {
  try {
    await redis.ping();
    res.json({ status: 'Ok', service: 'wishlist-service' });
  } catch (err) {
    res.status(503).json({ status: 'Unavailable', service: 'wishlist-service' });
  }
});

const wishKey = (userId) => `wishlist:${userId}`;

app.get('/api/wishlists/:userId', async (req, res) => {
  try {
    const data = await redis.hgetall(wishKey(req.params.userId));
    const wishlist = Object.entries(data || {}).map(([book_id, val]) => ({
      book_id, ...JSON.parse(val),
    }));
    res.json(wishlist);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/wishlists/:userId', async (req, res) => {
  const { userId } = req.params;
  const { book_id, name, image, price } = req.body;
  if (!book_id) return res.status(400).json({ message: 'book_id is required' });
  try {
    const exists = await redis.hexists(wishKey(userId), book_id);
    if (exists) return res.status(409).json({ message: 'Book already in wishlist' });

    let numericPrice = 0;
    if (typeof price === 'string') numericPrice = parseFloat(price.replace(/[^0-9.-]+/g, '')) || 0;
    else if (typeof price === 'number') numericPrice = price;

    await redis.hset(wishKey(userId), book_id, JSON.stringify({ name: name || '', image: image || '', price: numericPrice }));
    const data = await redis.hgetall(wishKey(userId));
    const wishlist = Object.entries(data).map(([book_id, val]) => ({ book_id, ...JSON.parse(val) }));
    res.status(201).json({ message: 'Added to wishlist', wishlist });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.delete('/api/wishlists/:userId/:bookId', async (req, res) => {
  const { userId, bookId } = req.params;
  try {
    await redis.hdel(wishKey(userId), bookId);
    const data = await redis.hgetall(wishKey(userId));
    const wishlist = Object.entries(data || {}).map(([book_id, val]) => ({ book_id, ...JSON.parse(val) }));
    res.json({ message: 'Removed from wishlist', wishlist });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

const PORT = process.env.PORT || 5006;
app.listen(PORT, '0.0.0.0', () => console.log(`Wishlist service running on port ${PORT}`));