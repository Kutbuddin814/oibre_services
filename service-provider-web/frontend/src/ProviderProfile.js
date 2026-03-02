import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import "./ProviderStyles.css";

const ProviderProfile = () => {
  const [provider, setProvider] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [showRemovalModal, setShowRemovalModal] = useState(false);
  const [removalReason, setRemovalReason] = useState("");
  const [removalSubmitting, setRemovalSubmitting] = useState(false);
  const [removalError, setRemovalError] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    mobile: "",
    serviceCategory: "",
    experience: ""
  });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const token = localStorage.getItem("providerToken");
  const navigate = useNavigate();
  const isCoordinateString = (value) =>
    typeof value === "string" &&
    /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(value);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(
          "/provider/me",
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
        setProvider(res.data);
      } catch {
        localStorage.removeItem("providerToken");
        navigate("/");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [token, navigate]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        setLoadingServices(true);
        const res = await api.get("/admin/services");
        const list = Array.isArray(res.data) ? res.data : [];
        setServiceOptions(list.map((s) => s.name).filter(Boolean));
      } catch (err) {
        console.error("Failed to fetch services", err);
        setServiceOptions([]);
      } finally {
        setLoadingServices(false);
      }
    };

    fetchServices();
  }, []);

  const submitRemovalRequest = async () => {
    if (!removalReason.trim()) {
      setRemovalError("Please provide a reason for removal.");
      return;
    }

    setRemovalError("");
    setRemovalSubmitting(true);

    try {
      await api.post(
        "/provider/removal-requests",
        { reason: removalReason.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShowRemovalModal(false);
      setRemovalReason("");
      alert("Removal request submitted. Admin will review it shortly.");
    } catch (err) {
      setRemovalError(
        err.response?.data?.message || "Failed to submit removal request."
      );
    } finally {
      setRemovalSubmitting(false);
    }
  };

  const openEditModal = () => {
    if (!provider) return;
    setEditForm({
      mobile: provider.mobile || "",
      serviceCategory: provider.serviceCategory || "",
      experience: provider.experience || ""
    });
    setEditError("");
    setShowEditModal(true);
  };

  const handleEditProfileSave = async () => {
    const mobile = String(editForm.mobile || "").trim();
    const serviceCategory = String(editForm.serviceCategory || "").trim();
    const experience = String(editForm.experience || "").trim();

    if (!/^[6-9]\d{9}$/.test(mobile)) {
      setEditError("Please enter a valid 10-digit mobile number.");
      return;
    }

    if (!serviceCategory) {
      setEditError("Service category is required.");
      return;
    }

    setEditError("");
    setEditSaving(true);

    try {
      const res = await api.put(
        "/provider/me",
        { mobile, serviceCategory, experience },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProvider(res.data.provider);
      setShowEditModal(false);
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setEditSaving(false);
    }
  };

  const reverseGeocode = async (lat, lng) => {
    const coordsFallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    const buildAddressFromParts = (address) => {
      if (!address) return "";
      return [
        address.road,
        address.suburb || address.neighbourhood || address.hamlet,
        address.village || address.town || address.city || address.county,
        address.state,
        address.country
      ]
        .filter(Boolean)
        .join(", ");
    };

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=en&lat=${lat}&lon=${lng}`
      );
      if (res.ok) {
        const data = await res.json();
        const fromParts = buildAddressFromParts(data?.address);
        const resolved = data?.display_name || fromParts;
        if (resolved) return resolved;
      }
    } catch {
      // Fall through to backup reverse-geocode provider.
    }

    try {
      const backup = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      if (backup.ok) {
        const data = await backup.json();
        const resolved = [
          data?.locality || data?.city || data?.principalSubdivision,
          data?.countryName
        ]
          .filter(Boolean)
          .join(", ");
        if (resolved) return resolved;
      }
    } catch {
      // Ignore backup error and return coordinate fallback.
    }

    return coordsFallback;
  };

  useEffect(() => {
    const resolveStoredAddress = async () => {
      if (!provider) return;
      const coords = provider.location?.coordinates || [];
      const rawAddress = provider.address || "";

      if (!isCoordinateString(rawAddress) || coords.length !== 2) {
        setResolvedAddress(rawAddress);
        return;
      }

      const readable = await reverseGeocode(coords[1], coords[0]);
      setResolvedAddress(readable);
    };

    resolveStoredAddress();
  }, [provider]);

  const saveProviderLocation = async ({ address, lat, lng }) => {
    if (!window.confirm("Your service location will be changed. Continue?")) {
      return;
    }

    setLocationError("");
    setLocationSaving(true);

    try {
      const res = await api.put(
        "/provider/location",
        { address, lat, lng },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setProvider(res.data.provider);
      setShowLocationModal(false);
      setLocationQuery("");
      setLocationResults([]);
      alert("Location updated successfully.");
    } catch (err) {
      setLocationError(
        err.response?.data?.message || "Failed to update location. Please try again."
      );
    } finally {
      setLocationSaving(false);
      setDetectingLocation(false);
    }
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationError("");
    setDetectingLocation(true);

    const getPosition = (options) =>
      new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    const detectAndSave = async () => {
      try {
        // Attempt 1: high accuracy GPS
        let pos = await getPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 0
        });

        let lat = pos.coords.latitude;
        let lng = pos.coords.longitude;

        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          throw new Error("Invalid location coordinates received");
        }

        let detectedAddress = await reverseGeocode(lat, lng);
        if (!detectedAddress) {
          detectedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        }

        await saveProviderLocation({ address: detectedAddress, lat, lng });
      } catch (firstErr) {
        try {
          // Attempt 2: relaxed accuracy/network position
          const pos = await getPosition({
            enableHighAccuracy: false,
            timeout: 10000,
            maximumAge: 60000
          });

          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            throw new Error("Invalid location coordinates received");
          }

          let detectedAddress = await reverseGeocode(lat, lng);
          if (!detectedAddress) {
            detectedAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          }

          await saveProviderLocation({ address: detectedAddress, lat, lng });
        } catch (err) {
          setDetectingLocation(false);
          if (err?.code === 1) {
            setLocationError("Location permission denied. Please allow location access in browser settings.");
            return;
          }
          if (err?.code === 2) {
            setLocationError("Location unavailable right now. Try again or search location manually.");
            return;
          }
          if (err?.code === 3) {
            setLocationError("Location request timed out. Try again in open area or search location manually.");
            return;
          }
          setLocationError("Could not detect location automatically. Please search and select location manually.");
        }
      }
    };

    detectAndSave();
  };

  const handleSelectSearchResult = (item) => {
    saveProviderLocation({
      address: item.address,
      lat: item.lat,
      lng: item.lng
    });
  };

  useEffect(() => {
    if (!showLocationModal) return;

    if (!locationQuery.trim() || locationQuery.trim().length < 2) {
      setLocationResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingLocations(true);
        setLocationError("");
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
            locationQuery.trim()
          )}`
        );

        if (!res.ok) {
          setLocationResults([]);
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
            address: item.display_name,
            title: primary,
            subtitle: secondaryParts.join(", "),
            lat: Number(item.lat),
            lng: Number(item.lon)
          };
        });

        setLocationResults(mapped);
      } catch (err) {
        console.error("Location search failed", err);
        setLocationResults([]);
      } finally {
        setSearchingLocations(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [locationQuery, showLocationModal]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!provider) return null;

  const profileImageUrl = provider.profilePhoto
    ? `https://oibre-backend-main.onrender.com/uploads/${encodeURIComponent(
        provider.profilePhoto
      )}`
    : null;

  return (
    <div className="profile-container">
      <div className="profile-card">
        <div className="profile-header">
          <div className="profile-avatar">
            {profileImageUrl ? (
              <img
                src={profileImageUrl}
                alt="Profile"
                onError={(e) => {
                  e.target.style.display = "none";
                }}
              />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%" }}>
                {provider.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <h2>{provider.name}</h2>
          <p>{provider.serviceCategory}</p>
        </div>

        <div className="profile-body">
          <div className="profile-field">
            <label>Email Address</label>
            <p>{provider.email}</p>
          </div>

          <div className="profile-field">
            <label>Phone Number</label>
            <p>{provider.mobile || "N/A"}</p>
          </div>

          <div className="profile-field">
            <label>Service Category</label>
            <p>{provider.serviceCategory}</p>
          </div>

          <div className="profile-field">
            <label>Location</label>
            <p>{resolvedAddress || provider.address || provider.locality || "N/A"}</p>
            <button
              className="profile-location-btn"
              onClick={() => setShowLocationModal(true)}
            >
              Change Location
            </button>
          </div>

          <div className="profile-field">
            <label>Remove Account</label>
            <p>If you want to stop providing services, you can request removal.</p>
            <button
              className="profile-remove-btn"
              onClick={() => setShowRemovalModal(true)}
            >
              Request Removal
            </button>
          </div>

          <div className="profile-field">
            <label>Experience</label>
            <p>{provider.experience || "N/A"}</p>
          </div>

          <div className="profile-field">
            <label>Status</label>
            <span className="request-status accepted" style={{ display: "inline-block" }}>
              {provider.status || "Active"}
            </span>
          </div>
        </div>

        <div className="profile-footer">
          <button
            onClick={() => navigate("/dashboard")}
            className="back-btn"
          >
            ← Back to Dashboard
          </button>
          <button className="edit-btn" onClick={openEditModal}>
            ✏️ Edit Profile
          </button>
        </div>
      </div>

      {showEditModal && (
        <div
          className="provider-location-backdrop"
          onClick={() => !editSaving && setShowEditModal(false)}
        >
          <div
            className="provider-location-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Edit Profile</h3>
            <p>Update your phone number, category, and experience.</p>

            <label className="provider-location-hint" style={{ display: "block", marginTop: 8 }}>
              Email (not editable)
            </label>
            <input
              type="text"
              className="provider-location-search"
              value={provider.email || ""}
              disabled
              style={{ background: "#f3f4f6", color: "#6b7280", cursor: "not-allowed" }}
            />

            <label className="provider-location-hint" style={{ display: "block", marginTop: 8 }}>
              Phone Number
            </label>
            <input
              type="text"
              className="provider-location-search"
              value={editForm.mobile}
              maxLength={10}
              inputMode="numeric"
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  mobile: e.target.value.replace(/[^0-9]/g, "")
                }))
              }
              placeholder="10-digit mobile number"
            />

            <label className="provider-location-hint" style={{ display: "block", marginTop: 8 }}>
              Service Category
            </label>
            <select
              className="provider-location-search"
              value={editForm.serviceCategory}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, serviceCategory: e.target.value }))
              }
            >
              <option value="">
                {loadingServices ? "Loading services..." : "Select service category"}
              </option>
              {serviceOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              {editForm.serviceCategory &&
                !serviceOptions.includes(editForm.serviceCategory) && (
                  <option value={editForm.serviceCategory}>
                    {editForm.serviceCategory}
                  </option>
                )}
            </select>

            <label className="provider-location-hint" style={{ display: "block", marginTop: 8 }}>
              Experience
            </label>
            <input
              type="text"
              className="provider-location-search"
              value={editForm.experience}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, experience: e.target.value }))
              }
              placeholder="e.g. 5 years"
            />

            {editError && <div className="error-message">{editError}</div>}

            <div className="provider-location-actions">
              <button
                className="action-btn secondary"
                onClick={() => setShowEditModal(false)}
                disabled={editSaving}
              >
                Cancel
              </button>
              <button
                className="action-btn primary"
                onClick={handleEditProfileSave}
                disabled={editSaving}
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showLocationModal && (
        <div
          className="provider-location-backdrop"
          onClick={() => setShowLocationModal(false)}
        >
          <div
            className="provider-location-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Change your location</h3>
            <p>Select a new location for your service area.</p>

            <input
              type="text"
              className="provider-location-search"
              placeholder="Search location (area, city, landmark)"
              value={locationQuery}
              onChange={(e) => setLocationQuery(e.target.value)}
            />

            {locationError && <div className="error-message">{locationError}</div>}

            <div className="provider-location-actions">
              <button
                onClick={handleUseCurrentLocation}
                disabled={locationSaving || detectingLocation}
                className="action-btn primary"
              >
                {detectingLocation ? "Detecting..." : "Auto Detect"}
              </button>
              <button
                onClick={() => setShowLocationModal(false)}
                className="action-btn secondary"
                disabled={locationSaving}
              >
                Cancel
              </button>
            </div>

            {searchingLocations && (
              <p className="provider-location-hint">Searching locations...</p>
            )}

            {locationResults.length > 0 && (
              <div className="provider-location-results">
                {locationResults.map((location, idx) => (
                  <button
                    key={`${location.address}-${idx}`}
                    type="button"
                    className="provider-location-item"
                    onClick={() => handleSelectSearchResult(location)}
                    disabled={locationSaving}
                  >
                    <span className="provider-location-title">
                      {location.title}
                    </span>
                    {location.subtitle && (
                      <span className="provider-location-subtitle">
                        {location.subtitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {locationSaving && (
              <p className="provider-location-hint">Saving location...</p>
            )}
          </div>
        </div>
      )}

      {showRemovalModal && (
        <div
          className="provider-location-backdrop"
          onClick={() => setShowRemovalModal(false)}
        >
          <div
            className="provider-location-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Request Removal</h3>
            <p>Tell us why you want to leave. This request will be sent to admin.</p>

            <textarea
              className="removal-textarea"
              rows="4"
              placeholder="Reason for removal..."
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
            />

            {removalError && <div className="error-message">{removalError}</div>}

            <div className="provider-location-actions">
              <button
                className="action-btn secondary"
                onClick={() => setShowRemovalModal(false)}
                disabled={removalSubmitting}
              >
                Cancel
              </button>
              <button
                className="action-btn danger"
                onClick={submitRemovalRequest}
                disabled={removalSubmitting}
              >
                {removalSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderProfile;
