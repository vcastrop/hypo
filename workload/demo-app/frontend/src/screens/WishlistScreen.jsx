import React, { useState, useEffect, useContext } from 'react';
import { Container, Row, Col, Card, Button, Image } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../lib/api';

const WishlistScreen = () => {
  const { user } = useContext(AuthContext);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    try {
      const { data } = await api.get(`/api/wishlists/${user.id}`);
      setWishlist(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (bookId) => {
    try {
      await api.delete(`/api/wishlists/${user.id}/${bookId}`);
      fetchWishlist();
    } catch (error) {
      console.error('Error removing from wishlist:', error);
    }
  };

  const addToCart = async (item) => {
    try {
      await api.post(`/api/cart/${user.id}`, {
        book_id: item.book_id,
        quantity: 1,
      });
      alert('Agregado al carrito');
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  if (!user) {
    return (
      <Container className="py-5 text-center">
        <h3>Debes iniciar sesión para ver tu lista de deseos</h3>
        <Link to="/login">
          <Button variant="primary" className="mt-3">Iniciar Sesión</Button>
        </Link>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <h2 className="mb-4">❤️ Mi Lista de Deseos</h2>

      {loading ? (
        <p>Cargando lista de deseos...</p>
      ) : wishlist.length === 0 ? (
        <div className="text-center py-5">
          <h4>Tu lista de deseos está vacía</h4>
          <Link to="/">
            <Button variant="primary" className="mt-3">Ver Catálogo</Button>
          </Link>
        </div>
      ) : (
        <Row>
          {wishlist.map((item) => (
            <Col key={item.book_id} sm={12} md={6} lg={4} xl={3} className="mb-3">
              <Card className="h-100 shadow-sm">
                <Link to={`/book/${item.book_id}`}>
                  <Card.Img
                    variant="top"
                    src={item.image || '/placeholder.png'}
                    style={{ height: '250px', objectFit: 'cover' }}
                  />
                </Link>
                <Card.Body className="d-flex flex-column">
                  <Card.Title>
                    <Link to={`/book/${item.book_id}`} className="text-decoration-none">
                      {item.name || 'Sin nombre'}
                    </Link>
                  </Card.Title>
                  <Card.Text className="fw-bold">{item.price}</Card.Text>
                  <div className="mt-auto d-flex gap-2">
                    <Button
                      variant="dark"
                      size="sm"
                      className="flex-grow-1"
                      onClick={() => addToCart(item)}
                    >
                      Agregar al Carrito
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => removeFromWishlist(item.book_id)}
                    >
                      ✕
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

export default WishlistScreen;
