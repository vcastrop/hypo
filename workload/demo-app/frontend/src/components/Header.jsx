import React, { useContext } from "react";
import { Container, Navbar, Nav, NavDropdown } from "react-bootstrap";
import { LinkContainer } from "react-router-bootstrap";
import { FaShoppingCart, FaHeart } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";

const Header = () => {
    const navigate = useNavigate();
    const { user, logout } = useContext(AuthContext);

    const handleLogout = () => {
        logout();
        navigate("/login");
    };

    return (
        <header>
            <Navbar bg="dark" variant="dark" expand="lg" collapseOnSelect>
                <Container>
                    <LinkContainer to="/">
                        <Navbar.Brand>MyBookStore</Navbar.Brand>
                    </LinkContainer>
                    <Navbar.Toggle aria-controls="basic-navbar-nav" />
                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="ms-auto">
                            {!user ? (
                                <LinkContainer to="/login">
                                    <Nav.Link>Iniciar sesión</Nav.Link>
                                </LinkContainer>
                            ) : (
                                <NavDropdown title={user.firstName + " " + user.lastName} id="user-dropdown">
                                    <LinkContainer to="/profile">
                                        <NavDropdown.Item>Mi perfil</NavDropdown.Item>
                                    </LinkContainer>
                                    <LinkContainer to="/orders">
                                        <NavDropdown.Item>Mis Órdenes</NavDropdown.Item>
                                    </LinkContainer>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item onClick={handleLogout}>
                                        Cerrar sesión
                                    </NavDropdown.Item>
                                </NavDropdown>
                            )}
                            {user && (
                                <>
                                    <LinkContainer to="/wishlist">
                                        <Nav.Link className="d-flex align-items-center">
                                            <FaHeart style={{ marginRight: "5px" }} />
                                            Deseos
                                        </Nav.Link>
                                    </LinkContainer>
                                    <LinkContainer to="/cart">
                                        <Nav.Link className="d-flex align-items-center">
                                            <FaShoppingCart style={{ marginRight: "5px" }} />
                                            Carrito
                                        </Nav.Link>
                                    </LinkContainer>
                                </>
                            )}
                            <LinkContainer to="/about">
                                <Nav.Link>Acerca de</Nav.Link>
                            </LinkContainer>
                        </Nav>
                    </Navbar.Collapse>
                </Container>
            </Navbar>
        </header>
    );
};

export default Header;
