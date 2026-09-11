import React, { useState, useEffect } from 'react';
import { Col, Row } from 'react-bootstrap';
import HomeCarousel from '../components/Carousel';
import Book from '../components/Book';
import { api } from '../lib/api';


const HomeScreen = () => {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const { data } = await api.get('/api/books/');
        setBooks(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error loading books:", error);
      }
    };
    fetchBooks();
  }, []);

  return (
    <>
      <HomeCarousel />

      <div className="container my-5">
        <h2 className="mb-4">Los Mas Vendidos</h2>
        <Row>
          {books.map((book) => (
            <Col key={book.id} sm={12} md={6} lg={4} xl={3}>
              <Book book={book} />
            </Col>
          ))}
        </Row>
      </div>
    </>
  );
};

export default HomeScreen;
