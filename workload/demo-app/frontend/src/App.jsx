import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Container } from 'react-bootstrap';

import Header from './components/Header';
import Footer from './components/Footer';
import HomeScreen from './screens/HomeScreen';
import BookScreen from './screens/BookScreen';
import AboutScreen from './screens/AboutScreen';
import LoginScreen from './screens/Login';
import ProfileScreen from './screens/ProfileScreen';
import CartScreen from './screens/CartScreen';
import OrdersScreen from './screens/OrdersScreen';
import WishlistScreen from './screens/WishlistScreen';


const App = () => {
  return (
    <Router>
      <Header />
      <main className='py-3'>
        <Container>
          <Routes>
            <Route path='/' element={<HomeScreen />} />
            <Route path='/about' element={<AboutScreen />} />
            <Route path='/login' element={<LoginScreen />} />
            <Route path='/book/:id'  element={<BookScreen />} />
            <Route path='/profile' element={<ProfileScreen />} />
            <Route path='/cart' element={<CartScreen />} />
            <Route path='/orders' element={<OrdersScreen />} />
            <Route path='/wishlist' element={<WishlistScreen />} />
          </Routes>
        </Container>
      </main>
      <Footer />
    </Router>
  )
}

export default App
