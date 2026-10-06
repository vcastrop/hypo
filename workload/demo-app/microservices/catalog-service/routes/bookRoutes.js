import express from 'express';
import { getBooks, getBooksById } from '../controllers/bookController.js';

const router = express.Router();

router.get('/', getBooks);

router.get('/:id', getBooksById);

export default router;
