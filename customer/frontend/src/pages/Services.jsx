import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../config/axios";
import "../styles/Services.css";

const INITIAL_VISIBLE_COUNT = 6;
const DEFAULT_ICON = "\uD83D\uDD27";
const ICON_BASE_URL = "http://localhost:5000/uploads";

const SERVICE_ICON_FALLBACKS = {
  "ac service": "\u2744\uFE0F",
  "appliance repair": "\uD83D\uDEE0\uFE0F",
  babysitter: "\uD83D\uDC76",
  carpenter: "\uD83E\uDE9A",
  cleaning: "\uD83E\uDDF9",
  electrician: "\u26A1",
  plumbing: "\uD83D\uDD27",
  mechanic: "\uD83D\uDD29",
  laundry: "\uD83E\uDDFA",
  taxi: "\uD83D\uDE95"
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
  const fallbackByName = SERVICE_ICON_FALLBACKS[normalizedName] || DEFAULT_ICON;

  if (!icon || typeof icon !== "string") return fallbackByName;
  const raw = icon.trim();
  if (!raw) return fallbackByName;

  let fixed = raw;
  if (/[ÃÂâð]/.test(fixed)) {
    fixed = toUtf8FromLatin1(fixed);
    if (/[ÃÂâð]/.test(fixed)) {
      fixed = toUtf8FromLatin1(fixed);
    }
  }

  if (!fixed || /[ÃÂâð�]/.test(fixed)) return fallbackByName;
  return fixed;
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
          {loading && <p className="services-message">Loading services...</p>}
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
