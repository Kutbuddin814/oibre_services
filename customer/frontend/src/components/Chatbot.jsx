import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import api from "../config/axios";
import MapPicker from "./MapPicker";
import "../styles/chatbot.css";

const DEFAULT_CATEGORY_OPTIONS = ["Electrician", "Plumber", "Carpenter", "AC Repair"];

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("greeting"); // greeting, category, location, urgency, providers
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
    const [_selectedLocation, _setSelectedLocation] = useState(null);
    const [_selectedUrgency, _setSelectedUrgency] = useState(null);
  const [categories, setCategories] = useState([]);
  const [problems, setProblems] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("unknown"); // unknown, granted, denied, skipped
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(true);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const chatEndRef = useRef(null);
  const [portalContainer, setPortalContainer] = useState(null);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const container = document.createElement("div");
    container.setAttribute("data-chatbot-portal", "true");
    document.body.appendChild(container);
    setPortalContainer(container);

    return () => {
      if (document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
  }, []);

  

  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus("denied");
      addMessage({
        type: "bot",
        text: "Location is not supported on this device.",
        options: [
          { label: "🗺 Select from map", value: "pick-location-map" }
        ]
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationStatus("granted");
        const resolvedLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          name: "Current Location"
        };
        setUserLocation(resolvedLocation);
        addMessage({
          type: "bot",
          text: "📍 Location detected! What service do you need?"
        });
      },
      () => {
        setLocationStatus("denied");
        addMessage({
          type: "bot",
          text: "Location access was cancelled. Please retry or select your location on map.",
          options: [
            { label: "🔁 Retry location", value: "retry-location" },
            { label: "🗺 Select from map", value: "pick-location-map" }
          ]
        });
      }
    );
  }, [addMessage]);

  const requestCallback = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      addMessage({
        type: "bot",
        text: "Please login first to request a callback."
      });
      return;
    }

    try {
      const locationText =
        userLocation?.name ||
        (userLocation?.lat && userLocation?.lng
          ? `${userLocation.lat}, ${userLocation.lng}`
          : "Not specified");

      const res = await api.post(
        "/chatbot/request-callback",
        {
          serviceType: selectedService || "General",
          location: locationText,
          preferredTime: "as soon as possible"
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      addMessage({
        type: "bot",
        text:
          res?.data?.message ||
          "Request received. We will notify you when a provider is available."
      });
    } catch (err) {
      console.error("Callback request failed:", err?.message);
      addMessage({
        type: "bot",
        text: "Could not place callback request right now. Please try again in a moment."
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user's current location
  useEffect(() => {
    if (isOpen && !userLocation && locationStatus === "unknown") {
      requestUserLocation();
    }
  }, [isOpen, userLocation, locationStatus, requestUserLocation]);
  // Load categories on first open
  useEffect(() => {
    if (isOpen && categories.length === 0) {
      loadCategories();
      addInitialGreeting();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps


  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const addInitialGreeting = () => {
    addMessage({
      type: "bot",
      text: "👋 Hi! I'm your AI assistant. What service do you need today?"
    });
  };

  const loadCategories = async () => {
    try {
      const res = await api.get("/chatbot/services/categories");
      if (res.data.success) {
        const fetched = res.data.categories || {};
        const keys = Object.keys(fetched);

        if (keys.length > 0) {
          setCategories(fetched);
        } else {
          const fallbackCategories = DEFAULT_CATEGORY_OPTIONS.reduce((acc, name) => {
            acc[name] = [];
            return acc;
          }, {});
          setCategories(fallbackCategories);
        }
      }
    } catch (err) {
      console.error("Error loading problems:", err?.message);

      const fallbackCategories = DEFAULT_CATEGORY_OPTIONS.reduce((acc, name) => {
        acc[name] = [];
        return acc;
      }, {});
      setCategories(fallbackCategories);
    }
  };

  const handleServiceSelect = async (serviceName) => {
    setSelectedService(serviceName);
    setServiceDropdownOpen(false);
    setShowAllServices(false);
    setStep("problem");
    addMessage({ type: "user", text: serviceName });
    addMessage({
      type: "bot",
      text: `Great! Looking for a ${serviceName}. What specific issue do you have?`
    });

    // Load problems for this service
    try {
      const res = await api.get(`/chatbot/services/problems/${serviceName}`);
      if (res.data.success) {
        const fetchedProblems = res.data.problems || [];
        setProblems(fetchedProblems);

        // If no problems are configured for this service, continue without blocking the user.
        if (fetchedProblems.length === 0) {
          addMessage({
            type: "bot",
            text: "I could not find predefined issues for this service. You can continue by selecting urgency."
          });
          addMessage({
            type: "bot",
            text: "⏰ When do you need this service?",
            options: [
              { label: "🚨 Emergency (within 1 hour)", value: "emergency" },
              { label: "📅 Today", value: "today" },
              { label: "📆 Schedule later", value: "later" }
            ]
          });
          setStep("urgency");
        }
      } else {
        setProblems([]);
        addMessage({
          type: "bot",
          text: "I could not fetch issues for this service. You can continue by selecting urgency."
        });
        addMessage({
          type: "bot",
          text: "⏰ When do you need this service?",
          options: [
            { label: "🚨 Emergency (within 1 hour)", value: "emergency" },
            { label: "📅 Today", value: "today" },
            { label: "📆 Schedule later", value: "later" }
          ]
        });
        setStep("urgency");
      }
    } catch (err) {
      console.error(err);
      setProblems([]);
      addMessage({
        type: "bot",
        text: "I could not load issue list right now. You can continue by selecting urgency after choosing any service."
      });
      addMessage({
        type: "bot",
        text: "⏰ When do you need this service?",
        options: [
          { label: "🚨 Emergency (within 1 hour)", value: "emergency" },
          { label: "📅 Today", value: "today" },
          { label: "📆 Schedule later", value: "later" }
        ]
      });
      setStep("urgency");
    }
  };

  const handleProblemSelect = async (problem) => {
    addMessage({ type: "user", text: problem.name });

    // Get price estimate
    try {
      const res = await api.get("/chatbot/estimate/price", {
        params: { serviceType: selectedService, problem: problem.name }
      });
      if (res.data.success && res.data.estimate) {
        addMessage({
          type: "bot",
          text: `📊 Estimated cost: ₹${res.data.estimate.min} - ₹${res.data.estimate.max}`
        });
      }
    } catch (err) {
      console.error(err);
    }

    addMessage({
      type: "bot",
      text: "⏰ When do you need this service?",
      options: [
        { label: "🚨 Emergency (within 1 hour)", value: "emergency" },
        { label: "📅 Today", value: "today" },
        { label: "📆 Schedule later", value: "later" }
      ]
    });

    setStep("urgency");
  };


  // Urgency mapping for backend
  const urgencyMap = {
    emergency: "emergency",
    today: "today",
    later: "later"
  };

  const handleUrgencySelect = (urgency) => {
    _setSelectedUrgency(urgency);
    addMessage({ type: "user", text: urgency });

    addMessage({
      type: "bot",
      text: "🔍 Finding best providers for you..."
    });

    loadProviders(urgencyMap[urgency] || urgency);
  };

  const handleOptionSelect = (value) => {
    if (value === "retry-location") {
      addMessage({ type: "user", text: "Retry location" });
      requestUserLocation();
      return;
    }

    if (["emergency", "today", "later"].includes(value)) {
      handleUrgencySelect(value);
      return;
    }

    if (value === "callback") {
      addMessage({ type: "user", text: "Request callback" });
      requestCallback();
      return;
    }
    if (value === "try-different-service") {
      addMessage({ type: "user", text: "Try different service" });

      setStep("greeting");
      setSelectedService(null);
      setProblems([]);

      addMessage({
        type: "bot",
        text: "No problem 👍 Choose another service:"
      });

      return;
    }

    if (value === "change-location") {
      addMessage({ type: "user", text: "Try different location" });
      addMessage({
        type: "bot",
        text: "Choose how you want to set location:",
        options: [
          { label: "📍 Auto detect current location", value: "retry-location" },
          { label: "🗺 Select from map", value: "pick-location-map" }
        ]
      });
      return;
    }

    if (value === "pick-location-map") {
      addMessage({ type: "user", text: "Select from map" });
      setShowMapPicker(true);
      return;
    }
  };

  const loadProviders = async (urgency) => {
    if (!userLocation) {
      addMessage({ type: "bot", text: "📍 Getting your location..." });
      requestUserLocation();
      setTimeout(() => {
        if (userLocation) {
          loadProviders(urgency);
        }
      }, 2000);
      return;
    }
    setLoading(true);
    try {
      const searchData = {
        serviceType: selectedService,
        urgency,
        lat: userLocation?.lat,
        lng: userLocation?.lng,
        sortBy: "rating"
      };
      const formattedService = selectedService;
      const res = await api.get("/providers", {
        params: {
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          serviceCategory: formattedService
        }
      });
     if (res.data && res.data.length > 0) {
      setStep("providers");

      displayProviderOptions({
        topRated: res.data.slice(0, 3),
        nearest: res.data.slice(3, 6),
        budget: res.data.slice(6, 9)
      });

    } else {
      addMessage({
        type: "bot",
        text: "❌ No providers found near you",
        options: [
          { label: "Change location", value: "change-location" },
          { label: "Try different service", value: "try-different-service" },
          { label: "Request callback", value: "callback" }
        ]
      });
    }
    } catch (err) {
      console.error("Error loading providers:", err?.message);
      addMessage({
        type: "bot",
        text: "❌ No providers found. Try changing location or urgency.",
        options: [
          { label: "Try different location", value: "change-location" },
          { label: "Request callback", value: "callback" }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const displayProviderOptions = (data) => {
    const recommendations = [
      {
        title: "⭐ Top Rated",
        providers: data.topRated,
        message: "Here are the best rated providers:"
      },
      {
        title: "📍 Nearest to You",
        providers: data.nearest,
        message: "Closest providers:"
      },
      {
        title: "💰 Budget Options",
        providers: data.budget,
        message: "Most affordable options:"
      }
    ];

    recommendations.forEach((rec, idx) => {
      if (rec.providers && rec.providers.length > 0) {
        addMessage({
          type: "bot",
          text: rec.message,
          providers: rec.providers,
          animation: idx === 0 ? "fade-in" : "slide-up"
        });
      }
    });
    addMessage({
      type: "bot",
      text: "Need anything else?",
      options: [
        { label: "🔁 Try another service", value: "try-different-service" },
        { label: "📞 Request callback", value: "callback" }
      ]
    });
  };

  const handleProviderSelect = (provider) => {
    addMessage({ type: "user", text: `Selected: ${provider.name}` });
    addMessage({
      type: "bot",
      text: `Perfect! ${provider.name} - ⭐ ${provider.averageRating ?? "N/A"} | ₹${provider.basePrice ?? "N/A"} | ${provider.distance ?? "N/A"}km away`
    });

    setStep("action");
    addMessage({
      type: "bot",
      text: "What would you like to do?",
      providerActions: true,
      providerId: provider._id,
      providerName: provider.name
    });
  };


  const handleAction = async (action, providerId) => {
    if (action === "chat") {
      addMessage({ type: "bot", text: "Opening chat..." });
      window.location.href = `/chat/${providerId}`;
    } else if (action === "book") {
      try {
        addMessage({ type: "bot", text: "Booking your service..." });
        const token = localStorage.getItem("token");
        // Use urgency argument directly for booking
        await api.post(
          "/booking/create",
          {
            providerId,
            serviceType: selectedService,
            urgency: urgencyMap[_selectedUrgency] || _selectedUrgency,
            location: userLocation
          },
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );
        addMessage({ type: "bot", text: "✅ Booking request sent! Provider will contact you soon." });
      } catch (err) {
        addMessage({ type: "bot", text: "❌ Could not book at this time. Please try again later." });
      }
    } else if (action === "save") {
      try {
        const token = localStorage.getItem("token");
        await api.post(
          "/chatbot/favorites/save",
          { providerId },
          token ? { headers: { Authorization: `Bearer ${token}` } } : {}
        );
        addMessage({ type: "bot", text: "❤️ Saved to favorites!" });
      } catch (err) {
        addMessage({ type: "bot", text: "❌ Could not save favorite. Please try again." });
      }
    }
  };

  const saveFavorite = async (providerId) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        addMessage({
          type: "bot",
          text: "Please login to save favorites"
        });
        return;
      }

      await api.post(
        "/chatbot/favorites/save",
        { providerId },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      addMessage({
        type: "bot",
        text: "❤️ Added to favorites!"
      });
    } catch (err) {
      console.error(err?.message || "Error saving favorite");
    }
  };

  const toggleChatbot = () => {
    setIsOpen(!isOpen);
  };

  const closeChatbot = () => {
    setIsOpen(false);
  };

  const categoryKeys = Object.keys(categories || {});
  const visibleCategoryKeys = showAllServices ? categoryKeys : categoryKeys.slice(0, 4);

  if (!portalContainer) {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {/* Floating Button */}
      <button
        className={`chatbot-floating-btn ${isOpen ? "active" : ""}`}
        onClick={toggleChatbot}
        title="AI Assistant"
      >
        {isOpen ? "✕" : "💬"}
      </button>

      {/* Chatbot Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-content">
              <h3>🤖 Service Assistant</h3>
              <p>Find services in seconds</p>
            </div>
            <button
              className="chatbot-close-btn"
              onClick={closeChatbot}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="chatbot-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`chatbot-message chatbot-${msg.type}`}>
                {msg.text && <p className="chatbot-text">{msg.text}</p>}

                {msg.options && (
                  <div className="chatbot-options">
                    {msg.options.map((opt, i) => (
                      <button
                        key={i}
                        className="chatbot-option-btn"
                        onClick={() => handleOptionSelect(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {msg.providers && (
                  <div className={`chatbot-providers${msg.animation ? ` chatbot-anim-${msg.animation}` : ''}`}>
                    {msg.providers.map((p, i) => (
                      <div
                        key={i}
                        className="chatbot-provider-card chatbot-provider-anim"
                        onClick={() => handleProviderSelect(p)}
                        tabIndex={0}
                        role="button"
                        aria-label={`Select provider ${p.name}`}
                        style={{ transitionDelay: `${i * 60}ms` }}
                      >
                        <div className="chatbot-provider-header">
                          <strong>{p.name}</strong>
                          <span className="chatbot-rating">
                            ⭐ {p.averageRating ?? "N/A"}
                          </span>
                        </div>
                        <div className="chatbot-provider-info">
                          <span>₹{p.basePrice ?? "N/A"}</span>
                          <span>📍 {p.distance ?? "N/A"}km</span>
                        </div>
                        {p.responseTime && (
                          <div className="chatbot-response-time">
                            ⏱️ Response: {p.responseTime}min
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {msg.providerActions && (
                  <div className="chatbot-actions">
                    <button
                      className="chatbot-action-btn primary"
                      onClick={() =>
                        handleAction("chat", msg.providerId, msg.providerName)
                      }
                    >
                      💬 Chat
                    </button>
                    <button
                      className="chatbot-action-btn success"
                      onClick={() =>
                        handleAction("book", msg.providerId, msg.providerName)
                      }
                    >
                      📅 Book
                    </button>
                    <button
                      className="chatbot-action-btn secondary"
                      onClick={() =>
                        handleAction("save", msg.providerId, msg.providerName)
                      }
                    >
                      ❤️ Save
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chatbot-message chatbot-bot">
                <div className="chatbot-loading">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {step === "greeting" && categoryKeys.length > 0 && (
            <div className="chatbot-input-area">
              <div className="chatbot-service-picker">
                <button
                  type="button"
                  className="chatbot-service-toggle"
                  onClick={() => setServiceDropdownOpen((prev) => !prev)}
                >
                  Select a service
                  <span>{serviceDropdownOpen ? "▴" : "▾"}</span>
                </button>

                {serviceDropdownOpen && (
                  <div className="chatbot-service-dropdown">
                    <div className="chatbot-categories">
                      {visibleCategoryKeys.map((cat) => (
                        <button
                          key={cat}
                          className="chatbot-category-btn"
                          onClick={() => handleServiceSelect(cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {categoryKeys.length > 4 && (
                      <button
                        type="button"
                        className="chatbot-show-more-btn"
                        onClick={() => setShowAllServices((prev) => !prev)}
                      >
                        {showAllServices ? "Show less" : `Show more (${categoryKeys.length - 4})`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {step === "problem" && problems && problems.length > 0 && (
            <div className="chatbot-input-area">
              <div className="chatbot-problems">
                {problems.slice(0, 4).map((prob, i) => (
                  <button
                    key={i}
                    className="chatbot-problem-btn"
                    onClick={() => handleProblemSelect(prob)}
                  >
                    {prob.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showMapPicker && (
            <MapPicker
              initialLat={userLocation?.lat}
              initialLng={userLocation?.lng}
              onClose={() => setShowMapPicker(false)}
              onConfirm={(lat, lng, fullAddress, locality, displayLabel) => {
                const resolved = {
                  lat,
                  lng,
                  name: displayLabel || locality || fullAddress || "Pinned location"
                };

                setUserLocation(resolved);
                setLocationStatus("granted");
                setShowMapPicker(false);

                addMessage({
                  type: "bot",
                  text: `📍 Location set to ${resolved.name}.`
                });

                if (selectedService && _selectedUrgency) {
                  addMessage({
                    type: "bot",
                    text: "Retrying provider search with your new location..."
                  });
                  loadProviders(_selectedUrgency);
                }
              }}
            />
          )}
        </div>
      )}
    </>,
    portalContainer
  );
};

export default Chatbot;