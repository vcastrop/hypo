import React, { useContext } from "react";
import { Container, Card, Row, Col, ListGroup, Image } from "react-bootstrap";
import { AuthContext } from "../context/AuthContext.jsx";

const ProfileScreen = () => {
  const { user } = useContext(AuthContext);

  if (!user) {
    return (
      <Container className="py-5 text-center">
        <h3>No estás autenticado</h3>
      </Container>
    );
  }

  const address = user.address || {};
  const profile = {
    firstName: user.firstName,
    lastName: user.lastName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    image: user.image,
    address: address.address,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country
  };



  return (
    <Container className="py-5">
      <h2 className="mb-4" style={{ marginLeft: 0 }}>Mi Perfil</h2>
      <Row className="justify-content-center">
        <Col md={10}>
          <Card className="shadow rounded-4 p-4">
            <Row>
              <Col md={4} className="d-flex justify-content-center align-items-start">
                <Image
                  src={profile.image}
                  roundedCircle
                  style={{ width: "150px", height: "150px", objectFit: "cover" }}
                />
              </Col>

              <Col md={8}>
                <h3>
                  {profile.firstName} {profile.lastName} ({profile.username})
                </h3>

                <ListGroup variant="flush">
                  <ListGroup.Item>
                    <strong>Email:</strong> {profile.email}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Teléfono:</strong> {profile.phone}
                  </ListGroup.Item>
                  <ListGroup.Item>
                    <strong>Dirección:</strong>{" "}
                    {`${profile.address}, ${profile.city}, ${profile.state}, ${profile.postalCode}, ${profile.country}`}
                  </ListGroup.Item>
                </ListGroup>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ProfileScreen;
