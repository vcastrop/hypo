import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './db.js';
import Review from './Review.js';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const toReviewDto = (review) => {
  const obj = review.toObject ? review.toObject() : review;
  return {
    id: obj._id,
    book_id: obj.book_id,
    userId: obj.user_id,
    userName: obj.user_name,
    rating: obj.rating,
    comment: obj.comment,
    date: obj.created_at,
  };
};

app.get('/health', (req, res) => res.json({ status: 'Ok', service: 'review-service' }));

app.get('/api/reviews/:bookId', async (req, res) => {
  try {
    const reviews = await Review.find({ book_id: req.params.bookId }).sort({ created_at: -1 });
    res.json(reviews.map(toReviewDto));
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.post('/api/reviews/:bookId', async (req, res) => {
  const { userId, userName, rating, comment } = req.body;
  if (!userId || !rating || !comment)
    return res.status(400).json({ message: 'userId, rating and comment are required' });
  try {
    const review = await Review.create({
      book_id: req.params.bookId,
      user_id: userId,
      user_name: userName || 'Anonymous',
      rating: Math.min(5, Math.max(1, Number(rating))),
      comment,
    });
    res.status(201).json({ message: 'Review added', review: toReviewDto(review) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

app.delete('/api/reviews/:bookId/:reviewId', async (req, res) => {
  try {
    await Review.findOneAndDelete({ _id: req.params.reviewId, book_id: req.params.bookId });
    res.json({ message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
});

const PORT = process.env.PORT || 5005;
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => console.log(`Review service running on port ${PORT}`));
});
