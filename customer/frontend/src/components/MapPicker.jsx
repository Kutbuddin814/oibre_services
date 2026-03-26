
import React, { useRef, useState, useEffect, useCallback } from "react";
import "./MapPicker.css";

// MapPicker: loads Google Maps JS API if VITE_GOOGLE_MAPS_API_KEY is set.
// Falls back to simple coordinate picker if API key missing.
export default function MapPicker({ initialLat, initialLng, onClose, onConfirm }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerInstanceRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [markerPos, setMarkerPos] = useState({ lat: initialLat || 15.4909, lng: initialLng || 73.8278 });
  const [labelText, setLabelText] = useState("");
  const [editing, setEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  const [localityPreference, setLocalityPreference] = useState("");
  useEffect(() => {
    document.body.classList.add("modal-open");
    return () => {
      if (!document.querySelector(".modal-backdrop") && !document.querySelector(".map-modal")) {
        document.body.classList.remove("modal-open");
      }
    };
  }, []);

  // Load Google Maps if apiKey present, otherwise set loaded so fallback runs
  useEffect(() => {
    if (!apiKey) {
      setLoaded(true);
      return;
    }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      if (window.google) setLoaded(true);
      else existing.addEventListener("load", () => setLoaded(true));
      return;
    }

    const s = document.createElement("script");
    s.id = "google-maps-script";
    s.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    s.async = true;
    s.defer = true;
    s.onload = () => setLoaded(true);
    document.head.appendChild(s);
  }, [apiKey]);

  // Helper: get detailed address information
  const getAddressDetails = useCallback(async (lat, lng) => {
    // Try Google Geocoder first if available
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      try {
        const result = await new Promise((resolve) => {
          new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results && results.length) {
              const formatted = results[0].formatted_address;
              const comp = results[0].address_components || {};
              
              // Extract components for better formatting
              let route = "", locality = "", adminArea = "", state = "", country = "";
              
              results[0].address_components.forEach((c) => { 
                if (c.types.includes("route")) route = c.long_name;
                if (c.types.includes("locality")) locality = c.long_name;
                if (c.types.includes("sublocality")) locality = locality || c.long_name;
                if (c.types.includes("administrative_area_level_2")) adminArea = c.long_name;
                if (c.types.includes("administrative_area_level_1")) state = c.short_name;
                if (c.types.includes("country")) country = c.long_name;
              });
              
              // Build display label (medium length for UI)
              const displayParts = [route, locality, state].filter(Boolean);
              const displayLabel = displayParts.length > 0 ? displayParts.join(", ") : formatted;
              
              return resolve({ 
                fullAddress: formatted,
                locality: locality || adminArea || "",
                displayLabel: displayLabel
              });
            }
            resolve(null);
          });
        });
        if (result) return result;
      } catch (e) {
        console.error("Google Geocoding error:", e);
        // fallthrough to Nominatim
      }
    }

    // Fallback: Nominatim reverse geocode - return full display_name
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      if (!res.ok) return null; 
      const data = await res.json();
      if (data) {
        const a = data.address || {};
        
        // Get locality for short display
          const prefer = [
            "neighbourhood",
            "suburb",
            "city_district",
            "village",
            "town",
            "city",
            "county"
          ];
        let locality = "";
        for (const key of prefer) {
          if (a[key]) {
            locality = a[key];
            break;
          }
        }
        
        // Build detailed address
        const addressParts = [];
        if (a.road) addressParts.push(a.road);
        if (a.suburb || a.neighbourhood) addressParts.push(a.suburb || a.neighbourhood);
        if (a.village || a.town || a.city) addressParts.push(a.village || a.town || a.city);
        if (a.state) addressParts.push(a.state);
        if (a.postcode) addressParts.push(a.postcode);
        if (a.country) addressParts.push(a.country);
        
        const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : data.display_name;
        
        // Build display label (road + locality + state for medium length)
        const displayParts = [
          a.road,
          locality,
          a.state
        ].filter(Boolean);
        const displayLabel = displayParts.length > 0 ? displayParts.join(", ") : fullAddress;
        
        return {
          fullAddress: fullAddress,
          locality: locality || (a.city || a.town || a.village || ""),
          displayLabel: displayLabel
        };
      }
      return null;
    } catch (e) {
      console.error("Nominatim geocoding error:", e);
      return null;
    }
  }, []);

  const resolveAndSetLabel = useCallback(async (lat, lng) => {
    const addressData = await getAddressDetails(lat, lng);
    let label = "Selected location";
    let fullAddress = "";
    let locality = "";
    if (addressData) {
      fullAddress = addressData.fullAddress;
      locality = addressData.locality;
      // NEW PRIORITY: displayLabel (shortened), then locality, then fullAddress, then fallback
      if (addressData.displayLabel) {
        label = addressData.displayLabel.split(",").slice(0, 2).join(",").trim();
      } else if (locality) {
        label = locality;
      } else if (fullAddress) {
        label = fullAddress;
      } else {
        label = "Selected location";
      }
      setLabelText(label);
      localStorage.setItem(
        "userLocation",
        JSON.stringify({
          lat,
          lng,
          label,         // detailed (for modal)
          locality,      // short (for navbar)
          fullAddress    // full
        })
      );
      window.dispatchEvent(new Event("userLocationChanged"));
      return addressData;
    }
    setLabelText(label);
    localStorage.setItem(
      "userLocation",
      JSON.stringify({
        lat,
        lng,
        label,
        fullAddress,
        locality
      })
    );
    window.dispatchEvent(new Event("userLocationChanged"));
    return null;
  }, [getAddressDetails]);

  // Main initializer: Google Maps OR Leaflet fallback
  useEffect(() => {
    if (!loaded) return;

    const updateMarkerAndMap = (lat, lng) => {
      if (markerInstanceRef.current) {
        markerInstanceRef.current.setPosition
          ? markerInstanceRef.current.setPosition({ lat, lng })
          : markerInstanceRef.current.setLatLng([lat, lng]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter
          ? mapInstanceRef.current.setCenter({ lat, lng })
          : mapInstanceRef.current.setView([lat, lng], mapInstanceRef.current.getZoom());
      }
    };

    // GOOGLE MAPS
    if (apiKey && window.google) {
      const center = { lat: markerPos.lat, lng: markerPos.lng };
      const map = new window.google.maps.Map(mapRef.current, { center, zoom: 14 });
      const marker = new window.google.maps.Marker({ position: center, map, draggable: true });
      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;

      map.addListener("click", async (e) => {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();
        marker.setPosition({ lat, lng });
        setMarkerPos({ lat, lng });
        await resolveAndSetLabel(lat, lng);
      });

      marker.addListener("dragend", async () => {
        const pos = marker.getPosition();
        const lat = pos.lat();
        const lng = pos.lng();
        setMarkerPos({ lat, lng });
        await resolveAndSetLabel(lat, lng);
      });

      // initial label
      (async () => {
        await resolveAndSetLabel(markerPos.lat, markerPos.lng);
      })();

      return () => {
        // Google Maps cleans up when element removed; nothing special
      };
    }

  // LEAFLET FALLBACK (no API key)
    (async () => {
      // load CSS
      if (!document.getElementById("leaflet-css")) {
        const lcss = document.createElement("link");
        lcss.id = "leaflet-css";
        lcss.rel = "stylesheet";
        lcss.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(lcss);
      }
      // load script
      if (!window.L) {
        await new Promise((resolve) => {
          if (document.getElementById("leaflet-script")) {
            document.getElementById("leaflet-script").addEventListener("load", resolve);
            return;
          }
          const ls = document.createElement("script");
          ls.id = "leaflet-script";
          ls.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          ls.async = true;
          ls.onload = resolve;
          document.head.appendChild(ls);
        });
      }

      // initialize map
      const map = window.L.map(mapRef.current).setView([markerPos.lat, markerPos.lng], 14);
      setTimeout(() => {
        map.invalidateSize();
      }, 100);
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
      }).addTo(map);

      const marker = window.L.marker([markerPos.lat, markerPos.lng], { draggable: true }).addTo(map);
      mapInstanceRef.current = map;
      markerInstanceRef.current = marker;

      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setMarkerPos({ lat, lng });
        await resolveAndSetLabel(lat, lng);
      });

      marker.on("dragend", async () => {
        const pos = marker.getLatLng();
        setMarkerPos({ lat: pos.lat, lng: pos.lng });
        await resolveAndSetLabel(pos.lat, pos.lng);
      });

      // initial reverse geocode
      (async () => {
        await resolveAndSetLabel(markerPos.lat, markerPos.lng);
      })();

      return () => {
        try { map.remove(); } catch (e) {}
      };
    })();

  }, [loaded]);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize?.();
    }, 200);
    return () => clearTimeout(timer);
  }, [loaded]);

  // Ensure we have a readable label when editing is closed
  useEffect(() => {
    if (!editing && !labelText) {
      resolveAndSetLabel(markerPos.lat, markerPos.lng);
    }
  }, [markerPos, editing, labelText, resolveAndSetLabel]);

  // Update label and storage when markerPos changes (DRY)
  useEffect(() => {
    if (loaded && !editing) {
      resolveAndSetLabel(markerPos.lat, markerPos.lng);
    }
  }, [loaded, markerPos, editing, resolveAndSetLabel]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearching(true);
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
            searchQuery.trim()
          )}`
        );
        if (!res.ok) {
          setSearchResults([]);
          return;
        }
        const data = await res.json();
        const mapped = (data || []).map((item) => {
          const a = item.address || {};
          const primary =
            a.suburb ||
            a.neighbourhood ||
            a.village ||
            a.town ||
            a.city ||
            item.name ||
            (item.display_name ? item.display_name.split(",")[0] : "Location");

          const secondaryParts = [
            a.city || a.town || a.village || a.county || "",
            a.state || "",
            a.country || ""
          ].filter(Boolean);

          return {
            title: primary,
            subtitle: secondaryParts.join(", "),
            address: item.display_name,
            lat: Number(item.lat),
            lng: Number(item.lon)
          };
        });
        setSearchResults(mapped);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [searchQuery]);

  const handleSelectSearchResult = (item) => {
    setMarkerPos({ lat: item.lat, lng: item.lng });
    // Use full address from search result
    setLabelText(item.address || "Selected location");
    setSearchQuery("");
    setSearchResults([]);

    // Do NOT write to localStorage here; resolveAndSetLabel will handle it after markerPos updates

    if (markerInstanceRef.current) {
      if (markerInstanceRef.current.setPosition) {
        markerInstanceRef.current.setPosition({ lat: item.lat, lng: item.lng });
      } else if (markerInstanceRef.current.setLatLng) {
        markerInstanceRef.current.setLatLng([item.lat, item.lng]);
      }
    }

    if (mapInstanceRef.current) {
      if (mapInstanceRef.current.setCenter) {
        mapInstanceRef.current.setCenter({ lat: item.lat, lng: item.lng });
      } else if (mapInstanceRef.current.setView) {
        mapInstanceRef.current.setView([item.lat, item.lng], mapInstanceRef.current.getZoom());
      }
    }
  };

  const handleAutoDetect = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      return;
    }

    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        setMarkerPos({ lat, lng });
        await resolveAndSetLabel(lat, lng); // handles localStorage and event

        // Update marker position
        if (markerInstanceRef.current) {
          if (markerInstanceRef.current.setPosition) {
            markerInstanceRef.current.setPosition({ lat, lng });
          } else if (markerInstanceRef.current.setLatLng) {
            markerInstanceRef.current.setLatLng([lat, lng]);
          }
        }

        // Center map on detected location
        if (mapInstanceRef.current) {
          if (mapInstanceRef.current.setCenter) {
            mapInstanceRef.current.setCenter({ lat, lng });
          } else if (mapInstanceRef.current.setView) {
            mapInstanceRef.current.setView([lat, lng], 14);
          }
        }

        setDetecting(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        let message = "Unable to detect location. ";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message += "Please allow location access in your browser.";
            break;
          case error.POSITION_UNAVAILABLE:
            message += "Location information unavailable.";
            break;
          case error.TIMEOUT:
            message += "Location request timed out.";
            break;
          default:
            message += "An unknown error occurred.";
        }
        alert(message);
        setDetecting(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  return (
    <div className="map-modal">
      <div className="map-backdrop" onClick={onClose} />
      <div className="map-content">
        <div className="map-header">
          <div>
            <h3>Pin your exact location</h3>
            <p className="map-subtitle">Auto-detect, search manually, or drop the pin on the map.</p>
          </div>
          <button className="map-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button 
            onClick={handleAutoDetect}
            disabled={detecting}
            className="btn btn-ghost"
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <span style={{ fontSize: '16px' }}>📍</span>
            {detecting ? "Detecting..." : "Auto Detect"}
          </button>
        </div>

        <div className="map-search">
          <input
            type="text"
            placeholder="Search location (area, city, landmark)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searching && <span className="map-searching">Searching...</span>}
        </div>

        {searchResults.length > 0 && (
          <div className="map-results">
            {searchResults.map((item, idx) => (
              <button
                key={`${item.address}-${idx}`}
                className="map-result-item"
                type="button"
                onClick={() => handleSelectSearchResult(item)}
              >
                <span className="map-result-title">{item.title}</span>
                {item.subtitle && (
                  <span className="map-result-subtitle">{item.subtitle}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div ref={containerRef} className="map-info">
          {!editing ? (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="map-label">{labelText || "Finding location..."}</div>
              <button className="btn btn-ghost" onClick={() => setEditing(true)} style={{ padding: '6px 8px' }}>Edit</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="map-label-input" defaultValue={labelText} onChange={(e) => setLabelText(e.target.value)} />
              <button className="btn btn-primary" onClick={() => setEditing(false)}>Save</button>
            </div>
          )}
        </div>
        <div
          ref={mapRef}
          id="map"
          style={{
            width: "100%",
            height: "300px",
            maxWidth: "100%",
            borderRadius: 12,
            overflow: "hidden"
          }}
        />

        {!apiKey && (
          <p style={{ fontSize: 12, color: "#666" }}>
            Google Maps API key not found. Using OpenStreetMap to pick location — click Confirm to use coordinates.
          </p>
        )}

        <div className="map-actions">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={async () => {
              setConfirming(true);
              let fullAddress = "";
              let locality = "";
              let displayLabel = labelText;

              // Fetch fresh address details with timeout (3s)
              let addressData = null;
              try {
                addressData = await Promise.race([
                  getAddressDetails(markerPos.lat, markerPos.lng),
                  new Promise((resolve) => setTimeout(() => resolve(null), 3000))
                ]);
              } catch {}

              if (addressData) {
                fullAddress = addressData.fullAddress;
                locality = addressData.locality;
                displayLabel =
                  addressData.locality ||
                  addressData.displayLabel ||
                  addressData.fullAddress ||
                  "Selected location";
              } else {
                // Fallback to coordinates
                const coordStr = `${markerPos.lat.toFixed(4)}, ${markerPos.lng.toFixed(4)}`;
                fullAddress = coordStr;
                locality = coordStr;
                displayLabel = coordStr;
              }

              // If displayLabel is just coordinates, but fullAddress is more descriptive, use fullAddress
              const isCoords = /^-?\d+\.\d{3,},\s*-?\d+\.\d{3,}$/.test(displayLabel.trim());
              if (isCoords && fullAddress && fullAddress !== displayLabel) {
                displayLabel = fullAddress;
              }

              // Store in localStorage on confirm as well
              localStorage.setItem(
                "userLocation",
                JSON.stringify({
                  lat: markerPos.lat,
                  lng: markerPos.lng,
                  label: displayLabel,
                  fullAddress: fullAddress,
                  locality: locality
                })
              );
              window.dispatchEvent(new Event("userLocationChanged"));

              // 🔥 Call backend API to update location in DB
              try {
                const token = localStorage.getItem("customerToken");
                if (token) {
                  await fetch(`${import.meta.env.VITE_API_URL}/api/customer/location`, {
                    method: "PUT",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      lat: markerPos.lat,
                      lng: markerPos.lng,
                      address: fullAddress,
                      locality: locality,
                    }),
                  });
                }
              } catch (err) {
                console.error("Location update failed:", err);
              }

              setConfirming(false);
              // Pass all address components to parent
              onConfirm(markerPos.lat, markerPos.lng, fullAddress, locality, displayLabel);
            }}
            className="btn btn-primary"
            disabled={confirming}
          >
            {confirming ? "Confirming..." : "Confirm location"}
          </button>
        </div>
      </div>
    </div>
  );
}
