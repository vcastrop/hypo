import React, { useState, useEffect, useContext } from 'react';
import { Container, ListGroup, Badge, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext.jsx';
import { api } from '../lib/api';

const OrdersScreen = () => {
  const { user } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchOrders = async () => {
      try {
        const { data } = await api.get(`/api/orders/${user.id}`);
        setOrders(data);
      } catch (error) {
        console.error('Error loading orders:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, [user]);

  if (!user) {
    return (
      <Container className="py-5 text-center">
        <h3>Debes iniciar sesión para ver tus órdenes</h3>
        <Link to="/login">
          <Button variant="primary" className="mt-3">Iniciar Sesión</Button>
        </Link>
      </Container>
    );
  }

  const getStatusBadge = (status) => {
    const variants = {
      confirmed: 'success',
      pending: 'warning',
      shipped: 'info',
      delivered: 'primary',
    };
    return <Badge bg={variants[status] || 'secondary'}>{status}</Badge>;
  };

  return (
    <Container className="py-4">
      <h2 className="mb-4">📦 Mis Órdenes</h2>

      {loading ? (
        <p>Cargando órdenes...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-5">
          <h4>No tienes órdenes aún</h4>
          <Link to="/">
            <Button variant="primary" className="mt-3">Ir al Catálogo</Button>
          </Link>
        </div>
      ) : (
        orders.map((order) => (
          <Card key={order.id} className="mb-3 shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>
                <strong>Orden #{order.id}</strong>
                {' — '}
                {new Date(order.date).toLocaleDateString('es-MX', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
              {getStatusBadge(order.status)}
            </Card.Header>
            <Card.Body>
              <ListGroup variant="flush">
                {order.items.map((item, idx) => (
                  <ListGroup.Item key={idx}>
                    <Row>
                      <Col md={6}>{item.name || `Book ${item.book_id}`}</Col>
                      <Col md={2}>Qty: {item.quantity}</Col>
                      <Col md={2}>${item.price}</Col>
                    </Row>
                  </ListGroup.Item>
                ))}
              </ListGroup>
              <div className="text-end mt-3">
                <strong>Total: ${order.total}</strong>
              </div>
            </Card.Body>
          </Card>
        ))
      )}
    </Container>
  );
};

export default OrdersScreen;
