import React, { useState, useEffect, useContext } from 'react';
import { api } from '../lib/api';
import { Link, useParams } from 'react-router-dom';
import { Row, Col, Image, ListGroup, Button, Form, Alert, Card } from 'react-bootstrap';
import { FaHeart, FaShoppingCart, FaStar } from 'react-icons/fa';
import { AuthContext } from '../context/AuthContext.jsx';

const BookScreen = () => {
  const [book, setBook] = useState({});
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');
  const [qty, setQty] = useState(1);
  const { id } = useParams();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBook = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/api/books/${id}`);
        setBook(data || {});
      } catch (err) {
        console.error("Error fetching book:", err);
        setMessage("No se pudo cargar la información del libro.");
      } finally {
        setLoading(false);
      }
    };
    fetchBook();
    fetchReviews();
  }, [id]);

  const fetchReviews = async () => {
    try {
      const { data } = await api.get(`/api/reviews/${id}`);
      setReviews(data || []);
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const addToCart = async () => {
    if (!user) {
      setMessage('Debes iniciar sesión para agregar al carrito');
      return;
    }
    try {
      await api.post(`/api/cart/${user.id}`, {
        book_id: id,
        quantity: qty,
      });
      setMessage('¡Agregado al carrito!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error al agregar al carrito');
    }
  };

  const addToWishlist = async () => {
    if (!user) {
      setMessage('Debes iniciar sesión para agregar a la lista de deseos');
      return;
    }
    try {
      await api.post(`/api/wishlists/${user.id}`, {
        book_id: id,
        name: book.name,
        image: book.image,
        price: book.price,
      });
      setMessage('¡Agregado a tu lista de deseos!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      if (error.response?.status === 409) {
        setMessage('Ya está en tu lista de deseos');
      } else {
        setMessage('Error al agregar a la lista de deseos');
      }
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      setMessage('Debes iniciar sesión para dejar una reseña');
      return;
    }
    try {
      await api.post(`/api/reviews/${id}`, {
        userId: String(user.id),
        userName: `${user.firstName} ${user.lastName}`,
        rating,
        comment,
      });
      setComment('');
      setRating(5);
      setMessage('¡Reseña publicada!');
      fetchReviews();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage('Error al publicar reseña');
    }
  };

  const renderStars = (count) => {
    return [...Array(5)].map((_, i) => (
      <FaStar key={i} color={i < count ? '#ffc107' : '#e4e5e9'} />
    ));
  };

  if (loading) {
    return <h2 className="text-center my-5">Cargando libro...</h2>;
  }

  if (!book || !book.id) {
    return (
      <div className="text-center my-5">
        <h2>Libro no encontrado</h2>
        <Link to='/' style={{ textDecoration: 'none' }}>
          <Button variant='primary' className="mt-3">Regresar al Catálogo</Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4">
        <Link to='/' style={{ textDecoration: 'none' }}>
          <Button variant='light' aria-label="Regresar a la página principal">
            ← Regresar al Catálogo
          </Button>
        </Link>
      </div>

      {message && <Alert variant="info" className="mb-3">{message}</Alert>}

      <Row>
        <Col md={4}>
          <Image src={book.image} alt={book.name} fluid />
        </Col>

        <Col md={4}>
          <ListGroup variant='flush'>
            <ListGroup.Item><h3>{book.name}</h3></ListGroup.Item>
            <ListGroup.Item>Autor: {book.author}</ListGroup.Item>
            <ListGroup.Item variant='flush'>Descripción: {book.description}</ListGroup.Item>
          </ListGroup>
        </Col>
        <Col md={4}>
          <ListGroup variant='flush'>
            <ListGroup.Item>
              Estado: {book.countInStock > 0 ? 'Disponible' : 'No Disponible'} ({book.countInStock}) uds
            </ListGroup.Item>
            <ListGroup.Item><strong>Precio:</strong> {book.price}</ListGroup.Item>
            <ListGroup.Item>
              <Row className="align-items-center">
                <Col>Cantidad:</Col>
                <Col>
                  <Form.Select
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    size="sm"
                  >
                    {[...Array(Math.max(book.countInStock || 1, 1)).keys()].map(x => (
                      <option key={x + 1} value={x + 1}>{x + 1}</option>
                    ))}
                  </Form.Select>
                </Col>
              </Row>
            </ListGroup.Item>
            <ListGroup.Item>
              <Button
                variant="dark"
                className="w-100 mb-2"
                onClick={addToCart}
              >
                <FaShoppingCart className="me-2" />
                Agregar al Carrito
              </Button>
              <Button
                variant="outline-danger"
                className="w-100"
                onClick={addToWishlist}
              >
                <FaHeart className="me-2" />
                Agregar a Lista de Deseos
              </Button>
            </ListGroup.Item>
          </ListGroup>
        </Col>
      </Row>

      {/* Reviews Section */}
      <Row className="mt-5">
        <Col md={6}>
          <h4 className="mb-3">Reseñas ({Array.isArray(reviews) ? reviews.length : 0})</h4>
          {!Array.isArray(reviews) || reviews.length === 0 ? (
            <p className="text-muted">No hay reseñas todavía. ¡Sé el primero!</p>
          ) : (
            <ListGroup variant="flush">
              {reviews.map((review) => (
                <ListGroup.Item key={review.id} className="mb-2">
                  <div className="d-flex justify-content-between">
                    <strong>{review.userName}</strong>
                    <small className="text-muted">
                      {review.date ? new Date(review.date).toLocaleDateString('es-MX') : ''}
                    </small>
                  </div>
                  <div className="my-1">{renderStars(review.rating)}</div>
                  <p className="mb-0">{review.comment}</p>
                </ListGroup.Item>
              ))}
            </ListGroup>
          )}
        </Col>

        <Col md={6}>
          <h4 className="mb-3">Escribe una Reseña</h4>
          {user ? (
            <Form onSubmit={submitReview}>
              <Form.Group className="mb-3">
                <Form.Label>Calificación</Form.Label>
                <Form.Select
                  value={rating}
                  onChange={(e) => setRating(Number(e.target.value))}
                >
                  <option value="5">5 - Excelente</option>
                  <option value="4">4 - Muy Bueno</option>
                  <option value="3">3 - Bueno</option>
                  <option value="2">2 - Regular</option>
                  <option value="1">1 - Malo</option>
                </Form.Select>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label>Comentario</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Escribe tu reseña aquí..."
                  required
                />
              </Form.Group>
              <Button type="submit" variant="dark">
                Publicar Reseña
              </Button>
            </Form>
          ) : (
            <p>
              <Link to="/login">Inicia sesión</Link> para escribir una reseña.
            </p>
          )}
        </Col>
      </Row>
    </>
  );
};

export default BookScreen;
