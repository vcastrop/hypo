import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  _id: { type: String },
  name: { type: String, required: true },
  author: String,
  description: String,
  price: String,
  countInStock: Number,
  image: String,
}, { _id: false });

const Book = mongoose.model('Book', bookSchema);

export const seedBooks = async () => {
  const count = await Book.countDocuments();
  if (count === 0) {
    await Book.insertMany([
      { _id: '1', name: 'Clean Code', author: 'Robert C. Martin', description: 'A Handbook of Agile Software Craftsmanship', price: '$29.99', countInStock: 10, image: 'https://m.media-amazon.com/images/I/41xShlnTZTL._SX376_BO1,204,203,200_.jpg' },
      { _id: '2', name: 'The Pragmatic Programmer', author: 'Andrew Hunt, David Thomas', description: 'From Journeyman to Master', price: '$39.99', countInStock: 5, image: 'https://m.media-amazon.com/images/I/41HXiIojloL._SX396_BO1,204,203,200_.jpg' },
      { _id: '3', name: 'Design Patterns', author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides', description: 'Elements of Reusable Object-Oriented Software', price: '$49.99', countInStock: 2, image: 'https://m.media-amazon.com/images/I/51szD9HC9pL._SX395_BO1,204,203,200_.jpg' },
      { _id: '4', name: 'Refactoring', author: 'Martin Fowler', description: 'Improving the Design of Existing Code', price: '$45.00', countInStock: 0, image: 'https://m.media-amazon.com/images/I/41H-1yCbbzL._SX395_BO1,204,203,200_.jpg' },
    ]);
    console.log('Books seeded into MongoDB');
  }
};

export default Book;