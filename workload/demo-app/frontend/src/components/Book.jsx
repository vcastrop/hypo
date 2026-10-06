import React from 'react';
import { Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';

const Book = ({ book }) => {
    return (
        <Card className="my-3 p-3 rounded shadow-sm h-100 book-card" style={{ transition: 'transform 0.2s' }}>
            <Link to={`/book/${book.id}`}>
                <Card.Img 
                    src={book.image || '/placeholder.png'} 
                    variant="top" 
                    style={{ height: '250px', objectFit: 'cover' }} 
                />
            </Link>

            <Card.Body className="d-flex flex-column">
                <Link to={`/book/${book.id}`} className="text-decoration-none">
                    <Card.Title as="div">
                        <strong>{book.name}</strong>
                    </Card.Title>
                </Link>
                <Card.Text as="h5" className="mt-auto fw-bold">{book.price}</Card.Text>
            </Card.Body>
        </Card>
    );
};

export default Book;
