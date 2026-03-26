
import Chatbot from "./components/Chatbot";
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
import FAQ from "./pages/FAQ";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Cookies from "./pages/Cookies";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ScrollToTop from "./components/ScrollToTop";
import MapPicker from "./components/MapPicker";
import { useEffect, useState } from "react";


export default function App() {
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [initialLat, setInitialLat] = useState(null);
  const [initialLng, setInitialLng] = useState(null);

  // Listen for openMapPicker event globally
  useEffect(() => {
    const handleOpenMapPicker = () => {
      // Try to use last location as initial
      try {
        const stored = localStorage.getItem("userLocation");
        if (stored) {
          const parsed = JSON.parse(stored);
          setInitialLat(parsed.lat || null);
          setInitialLng(parsed.lng || null);
        } else {
          setInitialLat(null);
          setInitialLng(null);
        }
      } catch {
        setInitialLat(null);
        setInitialLng(null);
      }
      setShowMapPicker(true);
    };
    window.addEventListener("openMapPicker", handleOpenMapPicker);
    return () => window.removeEventListener("openMapPicker", handleOpenMapPicker);
  }, []);

  // Handler for confirming location from MapPicker
  const handleMapPickerConfirm = (lat, lng, fullAddress, locality, displayLabel) => {
    // Save to localStorage (MapPicker already does this, but ensure event fires)
    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        lat,
        lng,
        label: displayLabel,
        fullAddress,
        locality
      })
    );
    setShowMapPicker(false);
    window.dispatchEvent(new Event("userLocationChanged"));
  };

  return (
    <>
      <ScrollToTop />
      <Navbar />
      <div className="flex min-h-[calc(100vh-80px)] flex-col bg-gray-50 w-full">
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
          <Route path="/faq" element={<FAQ />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/cookies" element={<Cookies />} />
        </Routes>
        <Footer />
      </div>
      <Chatbot />
      {showMapPicker && (
        <MapPicker
          initialLat={initialLat}
          initialLng={initialLng}
          onClose={() => setShowMapPicker(false)}
          onConfirm={handleMapPickerConfirm}
        />
      )}
    </>
  );
}
