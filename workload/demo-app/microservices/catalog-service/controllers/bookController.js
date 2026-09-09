import Book from '../models/Book.js';

// ← quitar el await seedBooks() de aquí

export const getBooks = async (req, res) => {
  try {
    const books = await Book.find();
    res.json(books.map(b => ({ ...b.toObject(), id: String(b._id) })));
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const getBooksById = async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ message: 'Book not found' });
    res.json({ ...book.toObject(), id: String(book._id) });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};