import { useEffect, useState } from "react";
import api from "./config/axios";
import API_BASE_URL from "./config/api";
import { useNavigate } from "react-router-dom";
import { convertTo12HourFormat } from "./utils/timeUtils";
import PaymentDetailsModal from "./PaymentDetailsModal";
import PaymentDetailsReminder from "./PaymentDetailsReminder";
import "./ProviderStyles.css";

const AUTO_REFRESH_MS = 10000;

const ProviderDashboard = () => {
  const [provider, setProvider] = useState(null);
  const [openMenu, setOpenMenu] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [completionOtps, setCompletionOtps] = useState({});
  const [finalPrices, setFinalPrices] = useState({});
  const [sendingOtpId, setSendingOtpId] = useState(null);
  const [submittingPriceId, setSubmittingPriceId] = useState(null);
  const [verifyingOtpId, setVerifyingOtpId] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTargetRequest, setCancelTargetRequest] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [showPaymentReminderModal, setShowPaymentReminderModal] = useState(false);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("providerToken");
  const getLocationSetupKey = (providerId) => `providerLocationChosen:${providerId}`;
  const isCoordinateString = (value) =>
    typeof value === "string" &&
    /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(value);

  const logout = () => {
    localStorage.removeItem("providerToken");
    navigate("/");
  };

  const resolveImageUrl = (value) => {
    if (!value || typeof value !== "string") return "";
    const normalized = value.trim().replace(/\\/g, "/");
    if (!normalized) return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;

    const apiBase = String(API_BASE_URL || "").replace(/\/$/, "");
    const backendBase = apiBase.replace(/\/api$/, "");

    if (normalized.startsWith("/uploads/")) return `${backendBase}${normalized}`;
    if (normalized.startsWith("uploads/")) return `${backendBase}/${normalized}`;
    return `${backendBase}/uploads/${normalized}`;
  };

  const formatRequests = (rows = []) =>
    rows.map((r) => ({
      ...r,
      visitDate: r.visitDate || r.preferredDate || "",
      visitTime: r.visitTime || r.preferredTime || "",
      providerNote: r.providerNote || ""
    }));

  const parseIsoDate = (value) => {
    if (!value || typeof value !== "string") return null;
    const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  };

  const toIsoDate = (date) => {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getVisitDateRange = (preferredDate) => {
    const base = parseIsoDate(preferredDate);
    if (!base) return { min: "", max: "" };

    const minDate = new Date(base);

    const maxDate = new Date(base);
    maxDate.setUTCDate(maxDate.getUTCDate() + 2);

    return {
      min: toIsoDate(minDate),
      max: toIsoDate(maxDate)
    };
  };

  const getTodayIsoLocal = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getCurrentTimeInputLocal = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  };

  const timeInputToMinutes = (value) => {
    if (!value || typeof value !== "string" || !value.includes(":")) return null;
    const [h, m] = value.split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };

  const getMinimumFinalPrice = (req) => {
    const minCandidate = Number(req?.basePrice ?? provider?.basePrice);
    if (Number.isFinite(minCandidate) && minCandidate > 0) {
      return Math.round(minCandidate);
    }
    return 1;
  };

  const refreshRequests = async () => {
    const res = await api.get(
      "/provider/requests/my-requests",
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    setRequests(formatRequests(res.data));
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
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setProvider(res.data.provider);
      const providerId = res.data?.provider?._id || provider?._id;
      if (providerId) {
        localStorage.setItem(getLocationSetupKey(providerId), "true");
      }
      setShowLocationModal(false);
      setLocationQuery("");
      setLocationResults([]);
      alert("Location updated successfully.");
    } catch (err) {
      setLocationError(
        err.response?.data?.message || "Failed to save location. Please try again."
      );
    } finally {
      setLocationSaving(false);
      setDetectingLocation(false);
    }
  };

  const handleUseRegisteredLocation = async () => {
    const coords = provider?.location?.coordinates || [];
    if (coords.length !== 2) {
      setLocationError("Registered location is unavailable. Please use current location.");
      return;
    }

    const maybeAddress = provider.address || "";
    const resolvedAddress = isCoordinateString(maybeAddress) || !maybeAddress.trim()
      ? await reverseGeocode(coords[1], coords[0])
      : maybeAddress;

    await saveProviderLocation({
      address: resolvedAddress,
      lat: coords[1],
      lng: coords[0]
    });
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationError("");
    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const detectedAddress = await reverseGeocode(lat, lng);

        await saveProviderLocation({ address: detectedAddress, lat, lng });
      },
      () => {
        setDetectingLocation(false);
        setLocationError("Could not detect current location. Please allow location permission.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSelectSearchResult = (item) => {
    saveProviderLocation({
      address: item.address,
      lat: item.lat,
      lng: item.lng
    });
  };

  /* ==========================
     FETCH PROVIDER PROFILE
  ========================== */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get(
          "/provider/me",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setProvider(res.data);

        // Check if payment details are completed
        if (res.data?.paymentDetailsCompleted === false) {
          setShowPaymentReminderModal(true);
        }

        // Only show location modal if provider hasn't set a location yet
        const hasLocationInDb =
          res.data?.location?.coordinates && res.data.location.coordinates.length === 2;
        const alreadyChosen =
          localStorage.getItem(getLocationSetupKey(res.data?._id)) === "true";
        
        if (!hasLocationInDb && !alreadyChosen) {
          setShowLocationModal(true);
        } else if (hasLocationInDb) {
          // If they already have a location, mark it as chosen so modal doesn't show
          localStorage.setItem(getLocationSetupKey(res.data?._id), "true");
        }
      } catch {
        logout();
      }
    };

    fetchProfile();
  }, []);

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

  /* ==========================
     FETCH SERVICE REQUESTS
  ========================== */
  useEffect(() => {
    if (!provider) return;

    const fetchRequests = async () => {
      try {
        await refreshRequests();
      } catch (err) {
        console.error("Failed to fetch requests:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, [provider, token]);

  useEffect(() => {
    if (!provider || !token) return undefined;

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        refreshRequests().catch((err) => {
          console.error("Auto-refresh requests failed:", err);
        });
      }
    };

    const intervalId = setInterval(() => {
      refreshIfVisible();
    }, AUTO_REFRESH_MS);

    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [provider, token]);

  /* ==========================
     UPDATE REQUEST
  ========================== */
  const updateRequest = async (req) => {
    if (req.visitDate === getTodayIsoLocal()) {
      const selected = timeInputToMinutes(req.visitTime);
      const now = timeInputToMinutes(getCurrentTimeInputLocal());
      if (selected !== null && now !== null && selected < now) {
        alert("Visit time cannot be in the past for today.");
        return;
      }
    }

    try {
      await api.put(
        `/provider/requests/update/${req._id}`,
        {
          visitDate: req.visitDate,
          visitTime: req.visitTime,
          providerNote: req.providerNote,
          status: "accepted"
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      await refreshRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update request. Please try again.");
    }
  };

  const updateRequestStatus = async (req, status) => {
    try {
      await api.put(
        `/provider/requests/update/${req._id}`,
        { status },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status. Please try again.");
    }
  };

  const sendCompletionOtp = async (req) => {
    try {
      setSendingOtpId(req._id);
      const res = await api.put(
        `/provider/requests/update/${req._id}`,
        { status: "completed" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const sentTo = res.data?.otpSentTo ? ` (${res.data.otpSentTo})` : "";
      alert(`OTP sent to customer email${sentTo}. Ask customer for OTP and verify.`);
      await refreshRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setSendingOtpId(null);
    }
  };

  const submitFinalPrice = async (req) => {
    const entered = String(finalPrices[req._id] || "").trim();
    const amount = Number(entered);
    const minimumAllowed = getMinimumFinalPrice(req);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Enter a valid final price.");
      return;
    }

    if (amount < minimumAllowed) {
      alert(`Final price cannot be below starting charge (Rs ${minimumAllowed}).`);
      return;
    }

    try {
      setSubmittingPriceId(req._id);
      await api.put(
        `/provider/requests/submit-price/${req._id}`,
        { finalPrice: amount },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Final price sent to customer for approval.");
      await refreshRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to send final price.");
    } finally {
      setSubmittingPriceId(null);
    }
  };

  const verifyCompletionOtp = async (req) => {
    const otp = String(completionOtps[req._id] || "").trim();
    if (!otp) {
      alert("Enter OTP first.");
      return;
    }

    try {
      setVerifyingOtpId(req._id);
      await api.post(
        `/provider/requests/verify-completion/${req._id}`,
        { otp },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Service marked completed.");
      setCompletionOtps((prev) => ({ ...prev, [req._id]: "" }));
      await refreshRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to verify OTP.");
    } finally {
      setVerifyingOtpId(null);
    }
  };

  const openCancelModal = (req) => {
    setCancelTargetRequest(req);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const closeCancelModal = () => {
    setShowCancelModal(false);
    setCancelTargetRequest(null);
    setCancelReason("");
    setCancelling(false);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangingPassword(false);
    setShowPassword({ current: false, next: false, confirm: false });
  };

  const submitChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert("Please fill all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("New password and confirm password do not match.");
      return;
    }
    if (newPassword.length < 6) {
      alert("New password must be at least 6 characters.");
      return;
    }

    try {
      setChangingPassword(true);
      const res = await api.put(
        "/provider/change-password",
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert(res.data?.message || "Password changed successfully.");
      closePasswordModal();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to change password.");
      setChangingPassword(false);
    }
  };

  const submitCancellation = async () => {
    if (!cancelTargetRequest?._id) return;
    const reason = String(cancelReason || "").trim();
    if (!reason) {
      alert("Please enter cancellation reason.");
      return;
    }

    try {
      setCancelling(true);
      await api.put(
        `/provider/requests/update/${cancelTargetRequest._id}`,
        { providerNote: reason, status: "cancelled" },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await refreshRequests();
      closeCancelModal();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel request.");
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="loading-container">
        <p>Unable to load dashboard</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-wrapper">
        <div className="dashboard-header">
          <h1>Service Provider Dashboard</h1>

          <div className="user-menu">
            <div
              className="avatar"
              onClick={() => setOpenMenu(!openMenu)}
            >
              {provider.name.charAt(0).toUpperCase()}
            </div>

            {openMenu && (
              <div className="dropdown-menu">
                <button onClick={() => setShowLocationModal(true)}>
                  Change Location
                </button>
                <button onClick={() => navigate("/profile")}>
                  View Profile
                </button>
                <button onClick={() => navigate("/earnings")}>
                  💰 My Earnings
                </button>
                <button
                  onClick={() => {
                    setOpenMenu(false);
                    setShowPasswordModal(true);
                  }}
                >
                  Change Password
                </button>
                <button onClick={logout} className="logout">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="dashboard-welcome">
          <h2>Welcome back, {provider.name.split(" ")[0]}!</h2>
          <p>Here are your pending service requests</p>
        </div>

        <div className="requests-section">
          <h3>Service Requests ({requests.length})</h3>

          {requests.length === 0 ? (
            <div className="empty-state">
              <p>No service requests assigned yet.</p>
              <p style={{ marginTop: "10px", fontSize: "12px" }}>
                Check back soon for new requests!
              </p>
            </div>
          ) : (
            requests.map((req, idx) => (
              <div key={req._id} className="request-card">
                <div className="request-header">
                  <h4>{req.customerName}</h4>
                  <span className={`request-status ${req.status}`}>
                    {req.status}
                  </span>
                </div>

                <div className="request-details">
                  <p>
                    <strong>Problem:</strong> {req.problemDescription}
                  </p>
                  {req.problemImage && (
                    <div className="problem-image-box">
                      <p>
                        <strong>Problem Image:</strong>
                      </p>
                      <img
                        src={resolveImageUrl(req.problemImage)}
                        alt="Customer problem"
                        className="request-problem-image"
                      />
                    </div>
                  )}
                  {req.customerPhone && (
                    <p>
                      <strong>Customer Phone:</strong>{" "}
                      <a href={`tel:${req.customerPhone}`}>{req.customerPhone}</a>
                    </p>
                  )}
                  <p>
                    <strong>Location:</strong> {req.address}
                  </p>
                  <p>
                    <strong>Preferred Time:</strong> {req.preferredDate} at {convertTo12HourFormat(req.preferredTime)}
                  </p>
                  {req.finalPrice ? (
                    <p>
                      <strong>Final Quote:</strong> Rs {req.finalPrice} ({(req.priceStatus || "pending").replace("_", " ")})
                    </p>
                  ) : (
                    <p>
                      <strong>Starting Charge:</strong> Rs {req.basePrice || provider.basePrice || "-"}
                    </p>
                  )}
                </div>

                {req.status === "pending" && (
                  <div className="request-actions">
                    <div className="request-input-group">
                      {(() => {
                        const dateRange = getVisitDateRange(req.preferredDate);
                        return (
                      <input
                        type="date"
                        value={req.visitDate || ""}
                        min={dateRange.min || undefined}
                        max={dateRange.max || undefined}
                        onChange={(e) => {
                          const copy = [...requests];
                          copy[idx].visitDate = e.target.value;
                          if (copy[idx].visitDate === getTodayIsoLocal()) {
                            const selected = timeInputToMinutes(copy[idx].visitTime);
                            const now = timeInputToMinutes(getCurrentTimeInputLocal());
                            if (selected !== null && now !== null && selected < now) {
                              copy[idx].visitTime = "";
                            }
                          }
                          setRequests(copy);
                        }}
                        placeholder="Visit Date"
                      />
                        );
                      })()}
                    </div>

                    <div className="request-input-group">
                      <input
                        type="time"
                        value={req.visitTime || ""}
                        min={req.visitDate === getTodayIsoLocal() ? getCurrentTimeInputLocal() : undefined}
                        onChange={(e) => {
                          const copy = [...requests];
                          copy[idx].visitTime = e.target.value;
                          setRequests(copy);
                        }}
                        placeholder="Visit Time"
                      />
                    </div>

                    <div className="request-input-group">
                      <textarea
                        placeholder="Add a note (optional)"
                        value={req.providerNote || ""}
                        onChange={(e) => {
                          const copy = [...requests];
                          copy[idx].providerNote = e.target.value;
                          setRequests(copy);
                        }}
                      />
                    </div>

                    <button
                      onClick={() => updateRequest(req)}
                      className="action-btn primary"
                    >
                      Accept & Schedule
                    </button>

                    <button
                      onClick={() => openCancelModal(req)}
                      className="action-btn danger"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {req.status === "accepted" && (
                  <div className="request-actions">
                    {req.priceStatus !== "price_approved" && (
                      <>
                        <div className="request-input-group" style={{ flex: 1 }}>
                          <input
                            type="number"
                            placeholder="Enter final price"
                            min={getMinimumFinalPrice(req)}
                            value={finalPrices[req._id] ?? req.finalPrice ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const minFinalPrice = getMinimumFinalPrice(req);
                              if (raw === "") {
                                setFinalPrices((prev) => ({ ...prev, [req._id]: "" }));
                                return;
                              }
                              const parsed = Number(raw);
                              if (Number.isFinite(parsed) && parsed < minFinalPrice) {
                                setFinalPrices((prev) => ({ ...prev, [req._id]: String(minFinalPrice) }));
                                return;
                              }
                              setFinalPrices((prev) => ({ ...prev, [req._id]: raw }));
                            }}
                          />
                        </div>
                        <button
                          onClick={() => submitFinalPrice(req)}
                          className="action-btn primary"
                          disabled={submittingPriceId === req._id}
                        >
                          {submittingPriceId === req._id ? "Sending..." : "Send Final Price"}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => updateRequestStatus(req, "in_progress")}
                      className="action-btn primary"
                      disabled={req.priceStatus !== "price_approved"}
                      title={req.priceStatus !== "price_approved" ? "Wait for customer to approve final price" : "Start service"}
                    >
                      Start Service
                    </button>
                    <button
                      onClick={() => openCancelModal(req)}
                      className="action-btn danger"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {req.status === "in_progress" && (
                  <div className="request-actions">
                    {req.priceStatus !== "price_approved" && (
                      <>
                        <div className="request-input-group" style={{ flex: 1 }}>
                          <input
                            type="number"
                            placeholder="Enter final price"
                            min={getMinimumFinalPrice(req)}
                            value={finalPrices[req._id] ?? req.finalPrice ?? ""}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const minFinalPrice = getMinimumFinalPrice(req);
                              if (raw === "") {
                                setFinalPrices((prev) => ({ ...prev, [req._id]: "" }));
                                return;
                              }
                              const parsed = Number(raw);
                              if (Number.isFinite(parsed) && parsed < minFinalPrice) {
                                setFinalPrices((prev) => ({ ...prev, [req._id]: String(minFinalPrice) }));
                                return;
                              }
                              setFinalPrices((prev) => ({ ...prev, [req._id]: raw }));
                            }}
                          />
                        </div>
                        <button
                          onClick={() => submitFinalPrice(req)}
                          className="action-btn primary"
                          disabled={submittingPriceId === req._id}
                        >
                          {submittingPriceId === req._id ? "Sending..." : "Send Final Price"}
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => sendCompletionOtp(req)}
                      className="action-btn primary"
                      disabled={sendingOtpId === req._id}
                    >
                      {sendingOtpId === req._id ? "Sending OTP..." : "Send Completion OTP"}
                    </button>
                    <div className="request-input-group" style={{ flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Enter customer OTP"
                        value={completionOtps[req._id] || ""}
                        onChange={(e) =>
                          setCompletionOtps((prev) => ({ ...prev, [req._id]: e.target.value }))
                        }
                      />
                    </div>
                    <button
                      onClick={() => verifyCompletionOtp(req)}
                      className="action-btn primary"
                      disabled={verifyingOtpId === req._id}
                    >
                      {verifyingOtpId === req._id ? "Verifying..." : "Verify OTP & Complete"}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {showLocationModal && (
        <div className="provider-location-backdrop">
          <div className="provider-location-modal">
            <div className="provider-location-header">
              <div>
                <h3>Choose your location</h3>
                <p>This helps customers see your current service area.</p>
              </div>
              <button
                className="provider-location-close"
                onClick={() => setShowLocationModal(false)}
                type="button"
                aria-label="Close"
              >
                ×
              </button>
            </div>

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
                {detectingLocation ? "Detecting..." : "Use Current Location"}
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

            {locationSaving && <p className="provider-location-hint">Saving location...</p>}
          </div>
        </div>
      )}

      {showCancelModal && (
        <div className="provider-location-backdrop">
          <div className="provider-location-modal">
            <div className="provider-location-header">
              <div>
                <h3>Cancel Request</h3>
                <p>Please provide a reason. This will be shown to customer and emailed.</p>
              </div>
              <button
                className="provider-location-close"
                onClick={closeCancelModal}
                type="button"
                aria-label="Close"
                disabled={cancelling}
              >
                ×
              </button>
            </div>

            <textarea
              className="provider-cancel-textarea"
              placeholder="Enter cancellation reason..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              disabled={cancelling}
            />

            <div className="provider-location-actions">
              <button
                onClick={closeCancelModal}
                disabled={cancelling}
                className="action-btn secondary"
                type="button"
              >
                Close
              </button>
              <button
                onClick={submitCancellation}
                disabled={cancelling}
                className="action-btn danger"
                type="button"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="provider-location-backdrop">
          <div className="provider-location-modal">
            <div className="provider-location-header">
              <div>
                <h3>Change Password</h3>
                <p>Use a strong password to keep your account secure.</p>
              </div>
              <button
                className="provider-location-close"
                onClick={closePasswordModal}
                type="button"
                aria-label="Close"
                disabled={changingPassword}
              >
                ×
              </button>
            </div>

            <div className="provider-password-group">
              <label>Current Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword.current ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, current: !prev.current }))
                  }
                  aria-label={showPassword.current ? "Hide password" : "Show password"}
                  disabled={changingPassword}
                >
                  &#128065;
                </button>
              </div>
            </div>

            <div className="provider-password-group">
              <label>New Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword.next ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, next: !prev.next }))
                  }
                  aria-label={showPassword.next ? "Hide password" : "Show password"}
                  disabled={changingPassword}
                >
                  &#128065;
                </button>
              </div>
            </div>

            <div className="provider-password-group">
              <label>Confirm New Password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={changingPassword}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))
                  }
                  aria-label={showPassword.confirm ? "Hide password" : "Show password"}
                  disabled={changingPassword}
                >
                  &#128065;
                </button>
              </div>
            </div>

            <div className="provider-location-actions">
              <button
                onClick={closePasswordModal}
                disabled={changingPassword}
                className="action-btn secondary"
                type="button"
              >
                Cancel
              </button>
              <button
                onClick={submitChangePassword}
                disabled={changingPassword}
                className="action-btn primary"
                type="button"
              >
                {changingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Reminder Modal */}
      <PaymentDetailsReminder
        isOpen={showPaymentReminderModal}
        onClose={() => setShowPaymentReminderModal(false)}
        onAddDetails={() => {
          setShowPaymentReminderModal(false);
          setShowPaymentDetailsModal(true);
        }}
      />

      {/* Payment Details Form Modal */}
      <PaymentDetailsModal
        isOpen={showPaymentDetailsModal}
        onClose={() => setShowPaymentDetailsModal(false)}
        onSave={() => {
          if (provider?._id) {
            // Refresh provider data to update paymentDetailsCompleted flag
            setProvider((prev) => ({
              ...prev,
              paymentDetailsCompleted: true
            }));
          }
        }}
      />
    </div>
  );
};

export default ProviderDashboard;
