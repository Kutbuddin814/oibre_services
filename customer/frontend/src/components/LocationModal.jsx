import { useState, useEffect } from "react";
import "../styles/locationModal.css";
import "../styles/unified-modal.css";
import "../styles/unified-forms.css";
import "../styles/unified-buttons.css";

export default function LocationModal({ 
  onLocationSelect, 
  onClose, 
  isDetecting = false,
  searchResults = [],
  isSearching = false,
  onSearch,
  locationError = ""
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDetectingLocal, setIsDetectingLocal] = useState(isDetecting);

  useEffect(() => {
    setIsDetectingLocal(isDetecting);
  }, [isDetecting]);

  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      if (!document.querySelector(".modal-backdrop") && !document.querySelector(".map-modal")) {
        document.body.classList.remove("modal-open");
      }
    };
  }, []);

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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-content">
            <h2 className="modal-title">
              {isDetecting ? "Welcome to Oibre" : "Change Location"}
            </h2>
            {!isDetecting && (
              <p className="modal-subtitle">
                Choose your service area to see providers near you.
              </p>
            )}
          </div>
          <button className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {isDetecting ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px 20px',
              gap: '16px'
            }}>
              <div style={{
                display: 'flex',
                gap: '8px'
              }}>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  animation: 'pulse 1.4s ease-in-out infinite'
                }}></span>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  animation: 'pulse 1.4s ease-in-out infinite 0.2s'
                }}></span>
                <span style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: '#2563eb',
                  animation: 'pulse 1.4s ease-in-out infinite 0.4s'
                }}></span>
              </div>
              <p style={{
                fontSize: '14px',
                color: '#64748b',
                fontWeight: '500'
              }}>Detecting your location...</p>
            </div>
          ) : (
            <div className="form">
              <button 
                className="btn btn-primary" 
                style={{ width: '100%' }}
                onClick={handleDetectLocation}
              >
                📍 Detect my location
              </button>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                margin: '12px 0'
              }}>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: '#e5e7eb'
                }}></div>
                <span style={{
                  fontSize: '13px',
                  color: '#9ca3b8',
                  fontWeight: '500'
                }}>OR</span>
                <div style={{
                  flex: 1,
                  height: '1px',
                  background: '#e5e7eb'
                }}></div>
              </div>

              <div className="modal-field">
                <label className="modal-field-label">Search Location</label>
                <input
                  type="text"
                  className="modal-field-input"
                  placeholder="Enter location or address"
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </div>

              {isSearching && searchQuery.trim().length > 0 && (
                <div style={{
                  padding: '12px',
                  textAlign: 'center',
                  color: '#64748b',
                  fontSize: '13px'
                }}>
                  Searching locations...
                </div>
              )}

              {locationError && (
                <div style={{
                  marginTop: '8px',
                  marginBottom: '8px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  color: '#9a3412',
                  fontSize: '13px',
                  fontWeight: '500'
                }}>
                  {locationError}
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }}>
                  {searchResults.map((location, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleLocationSelect(location)}
                      style={{
                        padding: '12px',
                        borderBottom: idx < searchResults.length - 1 ? '1px solid #e5e7eb' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        transition: 'background 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '16px', lineHeight: '1' }}>📍</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: '0 0 4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          color: '#0f172a',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {location.title || location.locality}
                        </p>
                        {location.subtitle && (
                          <p style={{
                            margin: '0',
                            fontSize: '12px',
                            color: '#64748b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {location.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.6;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
