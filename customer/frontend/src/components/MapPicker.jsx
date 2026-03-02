import React, { useCallback, useEffect, useRef, useState } from "react";

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
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

  // Helper: get readable label preferring locality/village names
  const getReadableLabel = useCallback(async (lat, lng) => {
    // Try Google Geocoder first if available
    if (window.google && window.google.maps && window.google.maps.Geocoder) {
      try {
        const label = await new Promise((resolve) => {
          new window.google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results && results.length) {
              const comp = results[0].address_components || [];
              const prefer = ["locality", "sublocality", "neighborhood", "postal_town", "administrative_area_level_3", "administrative_area_level_2"];
              for (const p of prefer) {
                const found = comp.find((c) => c.types && c.types.includes(p));
                if (found) return resolve(found.long_name);
              }
              return resolve(results[0].formatted_address);
            }
            resolve(null);
          });
        });
        if (label) return label;
      } catch (e) {
        // fallthrough to Nominatim
      }
    }

    // Fallback: Nominatim reverse geocode and prefer address fields
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      if (!res.ok) return null;
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        const prefer = ["hamlet", "village", "suburb", "neighbourhood", "town", "city_district", "city", "county", "state"];
        for (const key of prefer) {
          if (a[key]) {
            // include nearby larger area for clarity
            const extra = a.county || a.state || a.country;
            return extra ? `${a[key]}, ${extra}` : a[key];
          }
        }
      }
      return data.display_name || null;
    } catch (e) {
      return null;
    }
  }, []);

  const resolveAndSetLabel = useCallback(async (lat, lng) => {
    const label = await getReadableLabel(lat, lng);
    if (label) {
      setLabelText(label);
      return label;
    }
    setLabelText("Selected location");
    return null;
  }, [getReadableLabel]);

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

  // Ensure we have a readable label when editing is closed
  useEffect(() => {
    if (!editing && !labelText) {
      resolveAndSetLabel(markerPos.lat, markerPos.lng);
    }
  }, [markerPos, editing, labelText, resolveAndSetLabel]);

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
    const displayLabel = item.subtitle ? `${item.title}, ${item.subtitle}` : item.title;
    setMarkerPos({ lat: item.lat, lng: item.lng });
    setLabelText(displayLabel || item.address || "Selected location");
    setSearchQuery("");
    setSearchResults([]);

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

  return (
    <div className="map-modal">
      <div className="map-backdrop" onClick={onClose} />
      <div className="map-content">
        <div className="map-header">
          <div>
            <h3>Pin your exact location</h3>
            <p className="map-subtitle">Search manually or drop the pin on the map.</p>
          </div>
          <button className="map-close" onClick={onClose} aria-label="Close">
            ×
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
        <div ref={mapRef} id="map" style={{ width: "100%", height: "400px", borderRadius: 8 }} />

        {!apiKey && (
          <p style={{ fontSize: 12, color: "#666" }}>
            Google Maps API key not found. Using OpenStreetMap to pick location — click Confirm to use coordinates.
          </p>
        )}

        <div className="map-actions">
          <button onClick={onClose} className="btn btn-ghost">Cancel</button>
          <button
            onClick={() => {
              const confirm = async () => {
                const labelElement = containerRef.current?.querySelector(".map-label");
                let label = labelElement?.textContent || labelText;
                if (!label || label === "Selected location") {
                  const resolved = await getReadableLabel(markerPos.lat, markerPos.lng);
                  label = resolved || label || `${markerPos.lat.toFixed(4)}, ${markerPos.lng.toFixed(4)}`;
                }
                onConfirm(markerPos.lat, markerPos.lng, label);
              };
              confirm();
            }}
            className="btn btn-primary"
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}
