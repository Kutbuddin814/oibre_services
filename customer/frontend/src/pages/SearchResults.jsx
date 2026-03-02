import { useSearchParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import api from "../config/axios";
import "../styles/search.css";

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

  /* ==========================
     FETCH PROVIDERS
  ========================== */
  const fetchRef = useRef(null);

  const fetchProviders = async () => {
    try {
      setLoading(true);

      const resolveLocation = async () => {
        const storedLocation = localStorage.getItem("userLocation");
        if (storedLocation) {
          try {
            const parsed = JSON.parse(storedLocation);
            if (parsed) return parsed;
          } catch (e) {
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

      if (location && location.lat && location.lng) {
        // Use stored location
        const res = await api.get(
          "/providers",
          {
            params: {
              lat: location.lat,
              lng: location.lng,
              serviceCategory: query
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
                params: { serviceCategory: query }
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
                    serviceCategory: query
                  }
                }
              );

              setProviders(res.data);
              setLoading(false);
            },
            async () => {
              // fallback if location denied
              const res = await api.get(
                "/providers",
                {
                  params: { serviceCategory: query }
                }
              );

              setProviders(res.data);
              setLoading(false);
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
    setSearchText(query);
  }, [query]);

  useEffect(() => {
    // initial load / when query changes
    fetchProviders();

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

  return (
    <div className="search-page">
      <button 
        onClick={() => navigate(-1)} 
        className="back-button"
        title="Go back"
      >
        ← Back
      </button>

      {/* SEARCH BAR */}
      <div className="search-header">
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
        <aside className={`filters ${mobileFiltersOpen ? "mobile-open" : ""}`}>
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
          <div className="results-grid">
            {loading && <p>Loading...</p>}

            {!loading && filtered.length === 0 && (
              <p>No professionals found.</p>
            )}

            {filtered.map((p) => (
              <div className="result-card" key={p._id}>
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

                <p className="price">₹{p.finalPrice}</p>

                {/* 🔥 VIEW PROFILE INSTEAD OF BOOK */}
                <button className="profile-btn" onClick={() => openProfile(p._id)}>
                  View Profile
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
 
