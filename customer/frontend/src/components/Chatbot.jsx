import React, { useState, useEffect, useRef } from "react";
import { useCallback } from "react";
import api from "../config/axios";
import "../styles/chatbot.css";

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState("greeting"); // greeting, category, location, urgency, providers
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
    const [_selectedLocation, _setSelectedLocation] = useState(null);
    const [_selectedUrgency, _setSelectedUrgency] = useState(null);
    const [_providers, _setProviders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [problems, setProblems] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const chatEndRef = useRef(null);

  const addMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get user's current location
  useEffect(() => {
    if (isOpen && !userLocation) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              name: "Current Location"
            });
            addMessage({
              type: "bot",
              text: "📍 Location detected! What service do you need?"
            });
          },
          () => {
            addMessage({
              type: "bot",
              text: "Couldn't detect location. Where are you located?"
            });
          }
        );
      }
    }
  }, [isOpen, userLocation, addMessage]);
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
        setCategories(res.data.categories);
      }
    } catch (err) {
      console.error("Error loading problems:", err?.message);
    }
  };

  const handleServiceSelect = async (serviceName) => {
    setSelectedService(serviceName);
    addMessage({ type: "user", text: serviceName });
    addMessage({
      type: "bot",
      text: `Great! Looking for a ${serviceName}. What specific issue do you have?`
    });

    // Load problems for this service
    try {
      const res = await api.get(`/chatbot/services/problems/${serviceName}`);
      if (res.data.success) {
        setProblems(res.data.problems);
        setStep("problem");
      }
    } catch (err) {
      console.error(err);
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

  const handleUrgencySelect = (urgency) => {
    _setSelectedUrgency(urgency);
    addMessage({ type: "user", text: urgency });

    if (urgency === "emergency") {
      addMessage({
        type: "bot",
        text: "⚡ Finding available providers for emergency service..."
      });
    } else {
      addMessage({
        type: "bot",
        text: "Searching for best providers near you..."
      });
    }

    loadProviders(urgency);
  };

  const loadProviders = async (urgency) => {
    setLoading(true);
    try {
      const searchData = {
        serviceType: selectedService,
        category: selectedService,
        urgency,
        ...(userLocation || {}),
        sortBy: "rating"
      };

      const res = await api.post("/chatbot/providers/search", searchData);
      if (res.data.success) {
        _setProviders(res.data);
        setStep("providers");
        displayProviderOptions(res.data);
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

    recommendations.forEach((rec) => {
      if (rec.providers && rec.providers.length > 0) {
        addMessage({
          type: "bot",
          text: rec.message,
          providers: rec.providers
        });
      }
    });
  };

  const handleProviderSelect = (provider) => {
    addMessage({ type: "user", text: `Selected: ${provider.name}` });
    addMessage({
      type: "bot",
      text: `Perfect! ${provider.name} - ⭐ ${provider.rating} | ₹${provider.price} | ${provider.distance}km away`
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

  const handleAction = (action, providerId) => {
    if (action === "chat") {
      window.location.href = `/chat/${providerId}`;
    } else if (action === "book") {
      window.location.href = `/provider/${providerId}`;
    } else if (action === "save") {
      saveFavorite(providerId);
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

  return (
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
              onClick={() => setIsOpen(false)}
            >
              ✕
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
                        onClick={() => handleUrgencySelect(opt.value)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {msg.providers && (
                  <div className="chatbot-providers">
                    {msg.providers.map((p, i) => (
                      <div
                        key={i}
                        className="chatbot-provider-card"
                        onClick={() => handleProviderSelect(p)}
                      >
                        <div className="chatbot-provider-header">
                          <strong>{p.name}</strong>
                          <span className="chatbot-rating">
                            ⭐ {p.rating || 4.5}
                          </span>
                        </div>
                        <div className="chatbot-provider-info">
                          <span>₹{p.price || 300}</span>
                          <span>📍 {p.distance || "N/A"}km</span>
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

          {step === "greeting" && categories && Object.keys(categories).length > 0 && (
            <div className="chatbot-input-area">
              <div className="chatbot-categories">
                {Object.keys(categories)
                  .slice(0, 4)
                  .map((cat) => (
                    <button
                      key={cat}
                      className="chatbot-category-btn"
                      onClick={() => handleServiceSelect(cat)}
                    >
                      {cat}
                    </button>
                  ))}
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
        </div>
      )}
    </>
  );
};

export default Chatbot;
