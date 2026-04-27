import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../config/axios";
import { BACKEND_BASE_URL } from "../config/api";
import "../styles/Services.css";
import Loader from "../components/Loader";

const INITIAL_VISIBLE_COUNT = 6;
const DEFAULT_ICON = "🔧";
const ICON_BASE_URL = `${BACKEND_BASE_URL}/uploads`;

const SERVICE_ICON_FALLBACKS = {
  "ac service": "❄️",
  "appliance repair": "🛠️",
  babysitter: "👶",
  carpenter: "🪚",
  cleaning: "🧹",
  electrician: "⚡",
  plumber: "🔧",
  mechanic: "🔩",
  laundry: "🧺",
  taxi: "🚕",
  painter: "🎨",
  "pest control": "🐜",
  tutor: "📚",
  "salon at home": "💇‍♀️",
  "mover & packer": "📦"
};


const toUtf8FromLatin1 = (value) => {
  try {
    const bytes = new Uint8Array([...value].map((char) => char.charCodeAt(0) & 0xff));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return value;
  }
};

const normalizeIcon = (serviceName, icon) => {
  const normalizedName = String(serviceName || "").trim().toLowerCase();

  const fallback =
  SERVICE_ICON_FALLBACKS[normalizedName] || DEFAULT_ICON;

  const raw = icon || "";

  // detect broken encoding like ðŸ...
  if (!raw || /Ã|ðŸ|â|Â/.test(raw)) {
    return fallback;
  }

  return raw;
};

export default function Services() {
  const navigate = useNavigate();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAllServices, setShowAllServices] = useState(false);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await api.get("/services");
        setServices(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        console.error("Failed to load services:", err);
        setError("Failed to load services.");
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, []);

  const visibleServices = useMemo(() => {
    if (showAllServices) return services;
    return services.slice(0, INITIAL_VISIBLE_COUNT);
  }, [services, showAllServices]);

  return (
    <div className="services-page">
      <section className="services-hero">
        <h1>Our Services</h1>
        <p>Discover the wide range of professional services we offer to make your life easier.</p>
      </section>

      <section className="services-grid">
        <div className="services-container">
          {loading && (
            <div className="services-loader">
              <Loader text="Loading services..." />
            </div>
          )}
          {!loading && error && <p className="services-message services-error">{error}</p>}
          {!loading && !error && visibleServices.length === 0 && (
            <p className="services-message">No services found.</p>
          )}

          {!loading &&
            !error &&
            visibleServices.map((service) => (
              <div key={service._id || service.name} className="service-card">
                <div className="service-icon">
                  {service.iconImage ? (
                    <img
                      src={`${ICON_BASE_URL}/${service.iconImage}`}
                      alt={`${service.name || "Service"} icon`}
                      className="service-icon-image"
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <span className="service-icon-text">
                      {normalizeIcon(service.name, service.icon)}
                    </span>
                  )}
                </div>
                <h3>{service.name}</h3>
                <p>{service.description || "Professional service available near your location."}</p>
                <button
                  className="service-btn"
                  onClick={() => navigate(`/search?query=${encodeURIComponent(service.name || "")}`)}
                >
                  View Providers
                </button>
              </div>
            ))}
        </div>

        {!loading && !error && services.length > INITIAL_VISIBLE_COUNT && !showAllServices && (
          <div className="services-actions">
            <button className="service-btn more-services-btn" onClick={() => setShowAllServices(true)}>
              More Services
            </button>
          </div>
        )}
      </section>

      <section className="why-choose">
        <div className="why-content">
          <h2>Why Choose Oibre?</h2>
          <div className="features">
            <div className="feature">
              <div className="feature-icon">✓</div>
              <h3>Verified Professionals</h3>
              <p>All our service providers are verified and experienced in their fields.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">✓</div>
              <h3>Affordable Pricing</h3>
              <p>Competitive rates with no hidden charges. Transparent pricing always.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">✓</div>
              <h3>24/7 Support</h3>
              <p>Our customer support team is always available to help you.</p>
            </div>
            <div className="feature">
              <div className="feature-icon">✓</div>
              <h3>Quick Response</h3>
              <p>Get services booked and providers assigned within minutes.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}