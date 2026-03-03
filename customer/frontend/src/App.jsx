import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import SearchResults from "./pages/SearchResults";
import CustomerAuth from "./pages/CustomerAuth";
import CustomerProfile from "./pages/CustomerProfile";
import ProviderProfile from "./pages/ProviderProfile";  
import MyOrders from "./pages/MyOrders";
import Contact from "./pages/Contact";
import Services from "./pages/Services";
import About from "./pages/About";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
// test auto deploy
export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/auth" element={<CustomerAuth />} />
        <Route path="/profile" element={<CustomerProfile />} />
        <Route path="/provider/:id" element={<ProviderProfile />} />
        <Route path="/orders" element={<MyOrders />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/services" element={<Services />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <Footer />
    </>
  );
}
