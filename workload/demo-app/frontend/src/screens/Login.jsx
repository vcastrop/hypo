import { useContext, useState } from "react";
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Card from 'react-bootstrap/Card';
import Container from 'react-bootstrap/Container';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from "../context/AuthContext.jsx";


const Login = () => {

  const { login } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const username = e.target.username.value;
    const password = e.target.password.value;

    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container
      className="d-flex justify-content-center align-items-center"
      style={{ minHeight: '80vh' }}
    >
      <Card className="p-10 shadow rounded-4" style={{ width: '25rem' }}>
        <Card.Body>
          <h3 className="text-center mb-4">Iniciar Sesión</h3>

          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3" controlId="formBasicEmail">
              <Form.Label>Nombre de usuario:</Form.Label>
              <Form.Control
                type="text"
                name="username"
                placeholder="username"
                defaultValue="emilys"

              />
              <Form.Text className="text-muted">
                Usuario de demo local: emilys / emilyspass
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicPassword">
              <Form.Label>Contraseña:</Form.Label>
              <Form.Control
                type="password"
                name="password"
                placeholder="123456"
                defaultValue="emilyspass"
              />
            </Form.Group>

            <Form.Group className="mb-3" controlId="formBasicCheckbox">
              <Form.Check type="checkbox" label="Recuérdame" checked/>
            </Form.Group>

            <Button
              variant="primary"
              type="submit"
              className="w-100 mt-5 rounded-pill py-10"
              disabled={loading}
            >
              {loading ? "Autenticado usuario..." : "Ingresar"}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Login;
