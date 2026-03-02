import { useState, useEffect } from "react";
import "../styles/locationModal.css";

export default function LocationModal({ 
  onLocationSelect, 
  onClose, 
  isDetecting = false,
  searchResults = [],
  isSearching = false,
  onSearch
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDetectingLocal, setIsDetectingLocal] = useState(isDetecting);

  useEffect(() => {
    setIsDetectingLocal(isDetecting);
  }, [isDetecting]);

  const handleDetectLocation = () => {
    setIsDetectingLocal(true);
    if (onSearch) {
      onSearch({ type: 'detect' });
    }
  };

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch && query.trim().length > 1) {
      onSearch(query);
    } else if (query.trim().length <= 1) {
      setSearchQuery("");
    }
  };

  const handleLocationSelect = (location) => {
    if (onLocationSelect) {
      onLocationSelect(location);
    }
  };

  return (
    <div className="blinkit-location-backdrop" onClick={onClose}>
      <div className="blinkit-location-modal" onClick={(e) => e.stopPropagation()}>
        <button className="blinkit-location-close" onClick={onClose}>
          ✕
        </button>

        <h1 className="blinkit-location-title">
          {isDetecting ? "Welcome to Oibre" : "Change Location"}
        </h1>
        {!isDetecting && (
          <p className="blinkit-location-subtitle">
            Choose your service area to see providers near you.
          </p>
        )}

        {isDetecting ? (
          <div className="blinkit-detecting-container">
            <div className="blinkit-loading-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p className="blinkit-detecting-text">Detecting your location...</p>
          </div>
        ) : (
          <>
            <div className="blinkit-location-actions">
              <button 
                className="blinkit-detect-btn"
                onClick={handleDetectLocation}
              >
                Detect my location
              </button>

              <span className="blinkit-or-divider">OR</span>

              <input
                type="text"
                className="blinkit-location-search"
                placeholder="search delivery location"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>

            {searchResults && searchResults.length > 0 && (
              <div className="blinkit-search-results">
                {searchResults.map((location, idx) => (
                  <div
                    key={idx}
                    className="blinkit-result-item"
                    onClick={() => handleLocationSelect(location)}
                  >
                    <span className="blinkit-result-icon">📍</span>
                    <div className="blinkit-result-content">
                      <p className="blinkit-result-name">{location.title || location.locality}</p>
                      {location.subtitle && (
                        <p className="blinkit-result-address">{location.subtitle}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isSearching && searchQuery.trim().length > 0 && (
              <p className="blinkit-searching-status">Searching locations...</p>
            )}

          </>
        )}
      </div>
    </div>
  );
}
