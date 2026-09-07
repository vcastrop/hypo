import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  book_id: { type: String, required: true },
  user_id: { type: String, required: true },
  user_name: { type: String, default: 'Anonymous' },
  rating: { type: Number, min: 1, max: 5 },
  comment: String,
}, { timestamps: { createdAt: 'created_at' } });

export default mongoose.model('Review', reviewSchema);