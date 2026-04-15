import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../config/axios";
import "../styles/search.css";
import "../styles/search-page-layout.css";
import Loader from "../components/Loader";

const TIME_SLOTS = [
  "6:00 AM - 9:00 AM",
  "9:00 AM - 12:00 PM",
  "12:00 PM - 3:00 PM",
  "3:00 PM - 6:00 PM",
  "6:00 PM - 9:00 PM",
  "9:00 PM - 12:00 AM"
];

const parseTimeToMinutes = (timeStr) => {
  const match = timeStr.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM") {
    if (hour === 12) hour = 0;
  } else {
    if (hour !== 12) hour += 12;
  }

  return hour * 60 + minute;
};

const parseTimeRange = (rangeStr) => {
  if (!rangeStr || typeof rangeStr !== "string") return null;
  const parts = rangeStr.split("-").map((p) => p.trim());
  if (parts.length !== 2) return null;
  const start = parseTimeToMinutes(parts[0]);
  const end = parseTimeToMinutes(parts[1]);
  if (start === null || end === null) return null;
  return { start, end };
};

const rangesOverlap = (a, b) => {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
};

const getProviderRating = (provider) =>
  Number(provider?.averageRating ?? provider?.rating ?? 0);

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
    // Ignore decode failures and continue with fallback.
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
  if (hasEmoji(repaired) && !/Ã|â|�|ðŸ|Ð|Â/.test(repaired)) {
    return repaired;
  }

  return fallback;
};

export default function SearchResults() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("query") || "";

  const [rating, setRating] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [distance, setDistance] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [searchText, setSearchText] = useState(query);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🆕 Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  /* ==========================
     FETCH PROVIDERS
  ========================== */
  const fetchRef = useRef(null);

  /* ==========================
     FETCH RECOMMENDATIONS
  ========================== */
  const fetchRecommendations = async (searchQuery) => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      setRecommendations([]);
      return;
    }

    try {
      setRecommendationsLoading(true);
      const encodedQuery = encodeURIComponent(searchQuery.trim());
      const res = await api.get(`/services/recommendations/${encodedQuery}`);
      
      if (res.data.recommendations && res.data.recommendations.length > 0) {
        setRecommendations(res.data.recommendations);
      } else {
        setRecommendations([]);
      }
    } catch (error) {
      console.warn("Failed to fetch recommendations:", error);
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const fetchProviders = async () => {
    try {
      setLoading(true);

      const resolveLocation = async () => {
        const storedLocation = localStorage.getItem("userLocation");
        if (storedLocation) {
          try {
            const parsed = JSON.parse(storedLocation);
            if (parsed) return parsed;
          } catch {
            // ignore parse errors
          }
        }

        const token = localStorage.getItem("customerToken");
        if (token) {
          try {
            const profile = await api.get("/customers/profile", {
              headers: { Authorization: `Bearer ${token}` }
            });
            const coords = profile.data?.location?.coordinates || [];
            if (coords.length === 2) {
              const dbLocation = {
                lat: coords[1],
                lng: coords[0],
                address: profile.data.address,
                locality: profile.data.locality,
                label: profile.data.locality || profile.data.address,
                type: "registered"
              };
              localStorage.setItem("userLocation", JSON.stringify(dbLocation));
              return dbLocation;
            }
          } catch (err) {
            console.warn("Failed to resolve location from profile", err);
          }
        }

        return null;
      };

      const location = await resolveLocation();

      // Format query to match DB case (capitalize first letter, rest lowercase)
      const formattedQuery = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();

      if (location && location.lat && location.lng) {
        // Use stored location
        const res = await api.get(
          "/providers",
          {
            params: {
              lat: location.lat,
              lng: location.lng,
              serviceCategory: formattedQuery
            }
          }
        );

        setProviders(res.data);
        setLoading(false);
      } else {
        // If user has a registered locality (no coords), prefer using it
        if (location && (location.locality || location.address)) {
          try {
            const res = await api.get(
              "/providers",
              {
                params: { serviceCategory: formattedQuery }
              }
            );

            // simple client-side filter by locality/address substring
            const locality = (location.locality || location.address || "").toLowerCase();
            const filtered = res.data.filter((p) => {
              const addr = (p.address || "").toLowerCase();
              return locality && addr.includes(locality);
            });

            // If filtering yields results, use them; otherwise fall back to full list
            setProviders(filtered.length ? filtered : res.data);
            setLoading(false);
          } catch (err) {
            console.error(err);
            setLoading(false);
          }
        } else {
          // Try geolocation as a last resort
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;

              const res = await api.get(
                "/providers",
                {
                  params: {
                    lat,
                    lng,
                    serviceCategory: formattedQuery
                  }
                }
              );

              setProviders(res.data);
              setLoading(false);
            },
            async (error) => {
              // Log geolocation error for debugging
              console.warn("Geolocation error:", error.code, error.message);
              
              // fallback if location denied or unavailable
              const res = await api.get(
                "/providers",
                {
                  params: { serviceCategory: formattedQuery }
                }
              );

              setProviders(res.data);
              setLoading(false);
            },
            { 
              enableHighAccuracy: false, 
              timeout: 10000, 
              maximumAge: 0 // Don't use cached position
            }
          );
        }
      }
    } catch (err) {
      console.error("FETCH ERROR:", err);
      setLoading(false);
    }
  };

  // keep a ref for the handler so event listener can call it
  fetchRef.current = fetchProviders;

  useEffect(() => {
    // initial load / when query changes
    if (fetchRef.current) {
      fetchRef.current();
    }
    // Fetch recommendations when query changes
    fetchRecommendations(query);

    // react to programmatic changes to user location
    const handler = () => {
      if (fetchRef.current) fetchRef.current();
    };
    window.addEventListener("userLocationChanged", handler);
    return () => window.removeEventListener("userLocationChanged", handler);
  }, [query]);

  /* ==========================
     FILTER BY MULTIPLE CRITERIA
  ========================== */
  const filtered = providers.filter((p) => {
    const providerRating = getProviderRating(p);
    const providerDistance = p.distanceKm == null ? null : Number(p.distanceKm);

    // Rating filter
    if (rating && providerRating < Number(rating)) return false;
    
    // Price range filter
    if (priceRange) {
      const price = p.finalPrice || 0;
      if (priceRange === "100-300" && (price < 100 || price > 300)) return false;
      if (priceRange === "300-500" && (price < 300 || price > 500)) return false;
      if (priceRange === "500-1000" && (price < 500 || price > 1000)) return false;
      if (priceRange === "1000+" && price < 1000) return false;
    }
    
    // Distance filter
    if (distance && (providerDistance === null || providerDistance > Number(distance))) return false;
    
    // Time slot filter (overlap between selected slot and provider availability)
    if (timeSlot) {
      const selectedRange = parseTimeRange(timeSlot);
      const providerRange = parseTimeRange(p.availableTime || "");
      if (!selectedRange || !providerRange) return false;
      if (!rangesOverlap(selectedRange, providerRange)) return false;
    }
    
    return true;
  });

  /* ==========================
     OPEN PROVIDER PROFILE
  ========================== */
  const openProfile = (providerId) => {
    navigate(`/provider/${providerId}`);
  };

  const handleSearchSubmit = () => {
    const trimmed = (searchText || "").trim();
    if (!trimmed) return;
    navigate(`/search?query=${encodeURIComponent(trimmed)}`);
  };

  // const backButton = (
  //   <button
  //     type="button"
  //     onClick={() => navigate(-1)}
  //     className="search-back-button"
  //     title="Go back"
  //     aria-label="Go back"
  //   >
  //     ← Back
  //   </button>
  // );
  if (loading) return <Loader text="Searching providers..." />;
  return (
    <>
      
      <div className="search-page">
        <div className="search-container">
          {/* SEARCH BAR */}
          <div className="search-header">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="search-page-back-button"
            >
              ← Back
            </button>
            <div className="search-wrapper">
              <input
                className="search-input"
                placeholder="Search service (Plumber, Electrician...)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchSubmit();
                  }
                }}
              />
              <button className="search-button" onClick={handleSearchSubmit}>
                Search
              </button>
            </div>
          </div>

          <h2 className="results-header">
            Results for <span>"{query}"</span>
          </h2>

          {/* 🆕 SERVICE RECOMMENDATIONS SECTION */}
          {recommendations.length > 0 && !recommendationsLoading && (
            <div className="recommendations-section">
              <h3 className="recommendations-title">📌 Related Services</h3>
              <div className="recommendations-list">
                {recommendations.map((service) => (
                  <button
                    key={service._id}
                    className="recommendation-chip"
                    onClick={() => {
                      setSearchText(service.name);
                      navigate(`/search?query=${encodeURIComponent(service.name)}`);
                    }}
                    title={service.description}
                  >
                    {service.iconImage ? (
                      <img
                        src={service.iconImage}
                        alt=""
                        className="recommendation-icon-image"
                        loading="lazy"
                      />
                    ) : (
                      <span className="recommendation-icon">{normalizeServiceIcon(service.icon, service.name)}</span>
                    )}
                    <span className="recommendation-name">{service.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mobile-filter-row">
            <button
              type="button"
              className="mobile-filter-btn"
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
            >
              {mobileFiltersOpen ? "Hide Filters" : "Show Filters"}
            </button>
          </div>

          <div className="search-layout">
            {/* FILTERS */}
            <aside className={`filters${mobileFiltersOpen ? " mobile-open" : ""}`}>
              <h3>Filters</h3>
              {/* RATING FILTER */}
              <label>Minimum Rating</label>
              <select value={rating} onChange={(e) => setRating(e.target.value)} className="filter-select">
                <option value="">Any</option>
                <option value="3">⭐ 3.0+</option>
                <option value="3.5">⭐ 3.5+</option>
                <option value="4">⭐ 4.0+</option>
                <option value="4.5">⭐ 4.5+</option>
              </select>
              {/* PRICE FILTER */}
              <label>Price Range (₹)</label>
              <select value={priceRange} onChange={(e) => setPriceRange(e.target.value)} className="filter-select">
                <option value="">Any</option>
                <option value="100-300">₹100 - ₹300</option>
                <option value="300-500">₹300 - ₹500</option>
                <option value="500-1000">₹500 - ₹1000</option>
                <option value="1000+">₹1000+</option>
              </select>
              {/* DISTANCE FILTER */}
              <label>Maximum Distance (km)</label>
              <select value={distance} onChange={(e) => setDistance(e.target.value)} className="filter-select">
                <option value="">Any</option>
                <option value="1">Up to 1 km</option>
                <option value="3">Up to 3 km</option>
                <option value="5">Up to 5 km</option>
                <option value="10">Up to 10 km</option>
                <option value="25">Up to 25 km</option>
                <option value="30">Up to 30 km</option>
                <option value="35">Up to 35 km</option>
              </select>
              {/* TIME SLOT FILTER */}
              <label>Available Time Slot</label>
              <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className="filter-select">
                <option value="">Any Time</option>
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
              {/* CLEAR FILTERS */}
              <button 
                className="clear-filters-btn"
                onClick={() => {
                  setRating("");
                  setPriceRange("");
                  setDistance("");
                  setTimeSlot("");
                }}
              >
                Clear Filters
              </button>
            </aside>
            {/* RESULTS */}
            <section className="results">
              {loading && (
                <div className="results-grid">
                  {[...Array(6)].map((_, i) => (
                    <div className="service-card skeleton" key={i}></div>
                  ))}
                </div>
              )}
              {!loading && filtered.length === 0 && (
                <p>No professionals found.</p>
              )}
              {!loading && (
                <div className="results-grid">
                  {filtered.map((p) => (
                    <div className="service-card result-card" key={p._id}>
                      <div className="avatar">
                        {p.name ? p.name[0].toUpperCase() : "?"}
                      </div>
                      <h3>{p.name}</h3>
                      <p className="role">{p.displayService || p.serviceCategory}</p>
                      <p className="address">{p.address}</p>
                      {p.availableTime && (
                        <p className="time-slot">🕐 {p.availableTime}</p>
                      )}
                      {p.distanceKm !== undefined && (
                        <p className="distance">{p.distanceKm} km away</p>
                      )}
                      <p className="rating">⭐ {getProviderRating(p).toFixed(1)}</p>
                      <p className="price">Starting from ₹{p.finalPrice}</p>
                      {/* 🔥 VIEW PROFILE INSTEAD OF BOOK */}
                      <button className="profile-btn" onClick={() => openProfile(p._id)}>
                        View Profile
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
 
