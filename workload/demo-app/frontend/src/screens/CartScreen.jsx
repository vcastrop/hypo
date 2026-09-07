import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, ListGroup, Button, Image, Alert } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../lib/api';

const CartScreen = () => {
  const { user } = useContext(AuthContext);
  const [cartItems, setCartItems] = useState([]);
  const [bookDetails, setBookDetails] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    fetchCart();
  }, [user]);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/api/cart/${user.id}`);
      setCartItems(data.items || []);

      // Fetch book details for each cart item
      const details = {};
      for (const item of (data.items || [])) {
        try {
          const bookRes = await api.get(`/api/books/${item.book_id}`);
          details[item.book_id] = bookRes.data;
        } catch (e) {
          details[item.book_id] = { name: 'Libro no disponible', price: 0 };
        }
      }
      setBookDetails(details);
    } catch (error) {
      console.error('Error loading cart:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromCart = async (bookId) => {
    try {
      await api.delete(`/api/cart/${user.id}/${bookId}`);
      fetchCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  const checkout = async () => {
    try {
      const orderItems = cartItems.map(item => ({
        book_id: item.book_id,
        quantity: item.quantity,
        name: bookDetails[item.book_id]?.name || 'Unknown',
        price: bookDetails[item.book_id]?.price || 0,
      }));

      await api.post('/api/orders', {
        userId: String(user.id),
        items: orderItems,
      });

      // Clear cart items one by one
      for (const item of cartItems) {
        await api.delete(`/api/cart/${user.id}/${item.book_id}`);
      }

      setMessage('¡Orden creada exitosamente!');
      setCartItems([]);
      setBookDetails({});

      setTimeout(() => navigate('/orders'), 2000);
    } catch (error) {
      console.error('Error creating order:', error);
      setMessage('Error al crear la orden');
    }
  };

  if (!user) {
    return (
      <Container className="py-5 text-center">
        <h3>Debes iniciar sesión para ver tu carrito</h3>
        <Link to="/login">
          <Button variant="primary" className="mt-3">Iniciar Sesión</Button>
        </Link>
      </Container>
    );
  }

  const getTotal = () => {
    return cartItems.reduce((acc, item) => {
      const price = bookDetails[item.book_id]?.price || 0;
      return acc + (Number(String(price).replace('$', '')) * item.quantity);
    }, 0).toFixed(2);
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">🛒 Mi Carrito</h2>

      {message && <Alert variant="success">{message}</Alert>}

      {loading ? (
        <p>Cargando carrito...</p>
      ) : cartItems.length === 0 ? (
        <div className="text-center py-5">
          <h4>Tu carrito está vacío</h4>
          <Link to="/">
            <Button variant="primary" className="mt-3">Ver Catálogo</Button>
          </Link>
        </div>
      ) : (
        <Row>
          <Col md={8}>
            <ListGroup variant="flush">
              {cartItems.map((item) => {
                const book = bookDetails[item.book_id] || {};
                return (
                  <ListGroup.Item key={item.book_id} className="py-3">
                    <Row className="align-items-center">
                      <Col md={2}>
                        <Image
                          src={book.image || '/placeholder.png'}
                          alt={book.name}
                          fluid
                          rounded
                          style={{ maxHeight: '80px', objectFit: 'cover' }}
                        />
                      </Col>
                      <Col md={4}>
                        <Link to={`/book/${item.book_id}`} className="text-decoration-none">
                          <strong>{book.name || 'Cargando...'}</strong>
                        </Link>
                      </Col>
                      <Col md={2}>{book.price}</Col>
                      <Col md={2}>Qty: {item.quantity}</Col>
                      <Col md={2}>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => removeFromCart(item.book_id)}
                        >
                          Eliminar
                        </Button>
                      </Col>
                    </Row>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          </Col>
          <Col md={4}>
            <ListGroup className="shadow rounded">
              <ListGroup.Item>
                <h4>Resumen</h4>
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Artículos:</strong> {cartItems.reduce((a, i) => a + i.quantity, 0)}
              </ListGroup.Item>
              <ListGroup.Item>
                <strong>Total:</strong> ${getTotal()}
              </ListGroup.Item>
              <ListGroup.Item>
                <Button
                  variant="dark"
                  className="w-100"
                  onClick={checkout}
                  disabled={cartItems.length === 0}
                >
                  Confirmar Orden
                </Button>
              </ListGroup.Item>
            </ListGroup>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default CartScreen;
