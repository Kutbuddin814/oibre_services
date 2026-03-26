
import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import api from "../config/axios";
import "../styles/home.css";
import EmployeesOfMonth from "../components/EmployeesOfMonth";
// import LocationModal from "../components/LocationModal";
// import MapPicker from "../components/MapPicker";
import { detectUserLocation } from "../utils/locationDetection";

export default function Home() {
  // MapPicker modal logic moved to App.jsx for global handling
  const navigate = useNavigate();

  const [searchText, setSearchText] = useState("");
  const [services, setServices] = useState([]);
  const [serviceSuggestions, setServiceSuggestions] = useState([]);
  const [showServiceSuggestions, setShowServiceSuggestions] = useState(false);
  const [slide, setSlide] = useState(0);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  // Removed: showMenu, selectedLocation, locationQuery, locationResults, searchingLocations, detectingLocation, locationError, showNotifications (all unused)
  const [customerData, setCustomerData] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const menuRef = useRef();
  const notificationRef = useRef();
  const homeSearchRef = useRef();

  const token = localStorage.getItem("customerToken");
  const providerPortalUrl =
    import.meta.env.VITE_PROVIDER_URL || "http://localhost:3000";

  const carouselData = [
    {
      title: "Services In Your Area",
      subtitle: "Trusted professionals, right where you live.",
      image: "/images/location-services.png"
    },
    {
      title: "Verified Professionals",
      subtitle: "Only background-checked & rated experts.",
      image: "/images/verified-professionals.png"
    },
    {
      title: "Easy Booking",
      subtitle: "Book services in just a few clicks.",
      image: "/images/easy-booking.png"
    }
  ];

  const serviceKeywordIconMap = [
    { keys: ["electric", "electri"], icon: "⚡" },
    { keys: ["plumb"], icon: "🔧" },
    { keys: ["carpent", "wood"], icon: "🪚" },
    { keys: ["taxi", "cab", "driver"], icon: "🚕" },
    { keys: ["mechanic", "garage", "repair"], icon: "🔩" },
    { keys: ["paint"], icon: "🎨" },
    { keys: ["clean", "housekeep"], icon: "🧹" },
    { keys: ["babysit", "child"], icon: "👶" },
    { keys: ["ac", "air", "cool"], icon: "❄️" },
    { keys: ["appliance"], icon: "🛠️" },
    { keys: ["beauty", "salon"], icon: "💇" },
    { keys: ["cook", "chef"], icon: "👨‍🍳" },
    { keys: ["garden"], icon: "🌿" },
    { keys: ["laundry", "iron"], icon: "🧺" }
  ];

  const hasEmoji = (text) => /[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u.test(text || "");

  const decodeMojibake = (raw) => {
    if (!raw) return "";
    try {
      const decoded = decodeURIComponent(escape(raw));
      if (hasEmoji(decoded)) return decoded;
    } catch {
      // Ignore decode errors and continue with fallback logic.
    }
    return raw;
  };

  const getServiceFallbackIcon = (name) => {
    const lower = String(name || "").toLowerCase();
    const match = serviceKeywordIconMap.find((entry) =>
      entry.keys.some((k) => lower.includes(k))
    );
    return match?.icon || "🔧";
  };

  const normalizeServiceIcon = (icon, name) => {
    const raw = typeof icon === "string" ? icon.trim() : "";
    const fallback = getServiceFallbackIcon(name);
    if (!raw) return fallback;

    const repaired = decodeMojibake(raw).trim();
    if (hasEmoji(repaired) && !/Ã|â|�|ðŸ|Ð/.test(repaired)) {
      return repaired;
    }

    return fallback;
  };

  /* ================= CHECK LOGIN & FETCH CUSTOMER DATA ================= */
  useEffect(() => {
    const loadData = () => {
      const token = localStorage.getItem("customerToken");
      setIsLoggedIn(!!token);

      if (token) {
        // Try cached data first
        const cachedData = localStorage.getItem("customerData");
        if (cachedData) {
          try {
            setCustomerData(JSON.parse(cachedData));
          } catch (e) {
            console.error("Failed to parse cached customer data", e);
          }
        }
        
        // Then fetch fresh data
        fetchCustomerData();
        checkLocationModal();
      }
    };

    loadData();

    // Listen for storage changes from login
    const handleStorageChange = (e) => {
      if (e.key === "customerToken" || e.key === "customerData") {
        loadData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const fetchCustomerData = async () => {
    try {
      const res = await api.get(
        "/customers/profile",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCustomerData(res.data);
      localStorage.setItem("customerData", JSON.stringify(res.data));

      const coords = res.data?.location?.coordinates || [];
      if (coords.length === 2) {
        const existing = localStorage.getItem("userLocation");
        if (!existing) {
          localStorage.setItem(
            "userLocation",
            JSON.stringify({
              lat: coords[1],
              lng: coords[0],
              address: res.data.address,
              locality: res.data.locality,
              label: res.data.locality || res.data.address,
              type: "registered"
            })
          );
          window.dispatchEvent(new Event("userLocationChanged"));
        }
      }
    } catch (err) {
      console.error("Failed to fetch customer data", err);
    }
  };

  const checkLocationModal = () => {
    const hasShownLocationModal = localStorage.getItem("locationModalShown");
    if (!hasShownLocationModal) {
      // Removed setShowLocationModal(true);
    }
  };

  const persistLocationToServer = async (locationData) => {
    const authToken = localStorage.getItem("customerToken");
    if (!authToken) return;
    if (!Number.isFinite(Number(locationData?.lat)) || !Number.isFinite(Number(locationData?.lng))) return;

    try {
      const payload = {
        lat: locationData.lat,
        lng: locationData.lng,
        address: locationData.address || locationData.label || "",
        locality: locationData.locality || locationData.label || "Unknown"
      };

      const res = await api.put(
        "/customers/location",
        payload,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (res?.data?.customer) {
        localStorage.setItem("customerData", JSON.stringify(res.data.customer));
        setCustomerData(res.data.customer);
      }
    } catch (err) {
      console.error("Failed to persist selected location", err);
    }
  };

  const saveUserLocation = async (locationData) => {
    setSelectedLocation(locationData);
    localStorage.setItem("userLocation", JSON.stringify(locationData));
    localStorage.setItem("locationModalShown", "true");
    // Removed setShowLocationModal(false);
    await persistLocationToServer(locationData);
    window.dispatchEvent(new Event("userLocationChanged"));
  };

  const handleUseCurrentLocation = async () => {
    setLocationError("");
    setDetectingLocation(true);

    try {
      const detected = await detectUserLocation();
      await saveUserLocation({
        lat: detected.lat,
        lng: detected.lng,
        address: detected.address,
        locality: detected.locality,
        label: detected.label,
        type: detected.type
      });

      if (detected.source === "ip") {
        setLocationError("Using approximate IP location. You can refine it using search/map.");
      }
    } catch (err) {
      console.error("Location detection error:", err);
      setLocationError("Could not detect location automatically. Please search and select manually.");
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleUseRegisteredLocation = () => {
    if (!customerData) {
      setLocationError("Registered location not available.");
      return;
    }

    const coords = customerData.location?.coordinates || [];
    saveUserLocation({
      address: customerData.address,
      locality: customerData.locality,
      lat: coords.length === 2 ? coords[1] : null,
      lng: coords.length === 2 ? coords[0] : null,
      type: "registered"
    });
  };

  const handleSelectSearchResult = (item) => {
    saveUserLocation({
      address: item.address,
      locality: item.locality,
      lat: item.lat,
      lng: item.lng,
      type: "search"
    });
  };

  // Removed: locationQuery search effect (now handled in MapPicker)

  /* ================= FETCH NOTIFICATIONS ================= */
  useEffect(() => {
    if (!token) return;

    const fetchNotifications = async () => {
      try {
        const res = await api.get(
          "/notifications",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setNotifications(res.data);
      } catch (err) {
        console.error("Notification fetch error", err);
      }
    };

    fetchNotifications();
  }, [token]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  /* ================= FETCH SERVICES FOR TYPEAHEAD ================= */
  useEffect(() => {
    const loadServices = async () => {
      try {
        const res = await api.get("/services");
        setServices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load services for suggestions", err);
        setServices([]);
      }
    };

    loadServices();
  }, []);

  useEffect(() => {
    const q = String(searchText || "").trim().toLowerCase();
    if (!q) {
      setServiceSuggestions([]);
      setShowServiceSuggestions(false);
      return;
    }

    const suggestions = services
      .filter((s) => String(s?.name || "").toLowerCase().includes(q))
      .slice(0, 6);

    setServiceSuggestions(suggestions);
    setShowServiceSuggestions(suggestions.length > 0);
  }, [searchText, services]);

  /* ================= MARK AS READ ================= */
  const markAsRead = async (id) => {
    try {
      await api.put(
        `/notifications/read/${id}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, read: true } : n
        )
      );
    } catch (err) {
      console.error(err);
    }
  };

  /* ================= CAROUSEL ================= */
  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % carouselData.length);
    }, 4500);

    return () => clearInterval(timer);
  }, []);

  /* ================= CLOSE DROPDOWNS ================= */
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setShowNotifications(false);
      }
      if (homeSearchRef.current && !homeSearchRef.current.contains(e.target)) {
        setShowServiceSuggestions(false);
      }
    };

    const keyHandler = (e) => {
      if (e.key === "Escape") {
        setShowMenu(false);
        setShowNotifications(false);
      }
    };

    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", keyHandler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", keyHandler);
    };
  }, []);

  const handleSearch = () => {
    if (!searchText.trim()) return;
    setShowServiceSuggestions(false);
    navigate(`/search?query=${encodeURIComponent(searchText)}`);
  };

  const handlePickSuggestion = (serviceName) => {
    setSearchText(serviceName);
    setShowServiceSuggestions(false);
    navigate(`/search?query=${encodeURIComponent(serviceName)}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerData");
    localStorage.removeItem("userLocation");
    localStorage.removeItem("locationModalShown");
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="home">
      {/* ================= HERO ================= */}
      <section className="hero">
        <h1>Find Trusted Services Near You</h1>
        <p>Plumbers, Electricians, Carpenters, Taxi, Mechanics & more</p>

        <div className="home-search">
          <div className="search-wrapper" ref={homeSearchRef}>
            <input
              className="search-input"
              placeholder="Search service (Plumber, Electrician...)"
              value={searchText}
              onFocus={() => {
                if (serviceSuggestions.length > 0) setShowServiceSuggestions(true);
              }}
              onChange={(e) => setSearchText(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleSearch()
              }
            />
            <button
              className="search-button"
              onClick={handleSearch}
            >
              Search
            </button>

            {showServiceSuggestions && (
              <div className="home-service-suggestions" role="listbox" aria-label="Service suggestions">
                {serviceSuggestions.map((service) => (
                  <button
                    key={service._id || service.name}
                    type="button"
                    className="home-service-suggestion-item"
                    onClick={() => handlePickSuggestion(service.name)}
                  >
                    {service.iconImage ? (
                      <img
                        src={service.iconImage}
                        alt=""
                        className="home-service-suggestion-image"
                        loading="lazy"
                      />
                    ) : (
                      <span className="home-service-suggestion-icon" aria-hidden="true">
                        {normalizeServiceIcon(service.icon, service.name)}
                      </span>
                    )}
                    <span className="home-service-suggestion-name">{service.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="quick-services">
          <button
            type="button"
            className="service-item"
            onClick={() => navigate("/search?query=plumber")}
            title="Plumber"
          >
            <span className="service-chip" aria-hidden="true">🔧</span>
            <span className="service-label">Plumber</span>
          </button>

          <button
            type="button"
            className="service-item"
            onClick={() => navigate("/search?query=electrician")}
            title="Electrician"
          >
            <span className="service-chip" aria-hidden="true">⚡</span>
            <span className="service-label">Electrician</span>
          </button>

          <button
            type="button"
            className="service-item"
            onClick={() => navigate("/search?query=carpenter")}
            title="Carpenter"
          >
            <span className="service-chip" aria-hidden="true">🪚</span>
            <span className="service-label">Carpenter</span>
          </button>

          <button
            type="button"
            className="service-item"
            onClick={() => navigate("/search?query=taxi")}
            title="Taxi"
          >
            <span className="service-chip" aria-hidden="true">🚕</span>
            <span className="service-label">Taxi</span>
          </button>

          <button
            type="button"
            className="service-item"
            onClick={() => navigate("/search?query=mechanic")}
            title="Mechanic"
          >
            <span className="service-chip" aria-hidden="true">🔩</span>
            <span className="service-label">Mechanic</span>
          </button>
        </div>
      </section>

       {!isLoggedIn && (
      <section className="join-oibre">
        <div className="join-oibre-head">
          <h2>Join Oibre</h2>
          <p>Create an account based on how you want to use Oibre.</p>
        </div>

        <div className="join-oibre-grid">
          <article className="join-card">
            <div className="join-badge">Customer</div>
            <h3>Need a service?</h3>
            <p>
              Register as a customer to book trusted professionals and track updates in
              Notifications and My Orders.
            </p>
            <button
              type="button"
              className="join-btn primary"
              onClick={() => navigate("/auth")}
            >
              Register as Customer
            </button>
          </article>

          <article className="join-card provider">
            <div className="join-badge">Service Provider</div>
            <h3>Offer your services</h3>
            <p>
              Join as a service provider to receive local bookings, manage schedules, and
              grow your work.
            </p>
            <button
              type="button"
              className="join-btn secondary"
              onClick={() => window.open(providerPortalUrl, "_blank", "noopener,noreferrer")}
            >
              Join as Service Provider
            </button>
          </article>
        </div>
      </section>
       )}

      {/* ================= CAROUSEL ================= */}
      <section className="carousel-section">
        <div className="carousel-card">
          <div className="carousel-left">
            <h2>{carouselData[slide].title}</h2>
            <p>{carouselData[slide].subtitle}</p>
          </div>
          <div className="carousel-right">
            <img
              src={carouselData[slide].image}
              alt="carousel"
            />
          </div>
        </div>
      </section>

      <section className="section-divider">
        <span>— Celebrating Our Best Professionals —</span>
      </section>

      <EmployeesOfMonth />

      <section className="why-choose">
        <h2>Why Choose LocalServe?</h2>
        <div className="why-grid">
          <div className="why-card">✔ Nearby Professionals</div>
          <div className="why-card">⚡ Quick Booking</div>
          <div className="why-card">⭐ Trusted Ratings</div>
        </div>
      </section>



      {/* MapPicker modal is now handled globally in App.jsx */}
    </div>
  );
}
