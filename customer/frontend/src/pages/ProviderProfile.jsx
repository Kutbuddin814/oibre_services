import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../config/axios";
import { BACKEND_BASE_URL } from "../config/api";
import "../styles/providerProfile.css";

// Helper function to resolve image URLs (handles both Cloudinary and local paths)
const resolveImageUrl = (imagePath) => {
  if (!imagePath) return "";
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath; // Cloudinary URL
  }
  // Local path
  if (imagePath.startsWith("/uploads/")) {
    return `${BACKEND_BASE_URL}${imagePath}`;
  }
  return `${BACKEND_BASE_URL}/uploads/${imagePath}`;
};

export default function ProviderProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [provider, setProvider] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [distanceKm, setDistanceKm] = useState(null);
  const [finalPrice, setFinalPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingComment, setEditingComment] = useState("");
  const [editingRating, setEditingRating] = useState(5);
  const [editingImage, setEditingImage] = useState(null);
  const [editingImagePreview, setEditingImagePreview] = useState("");
  const [removeEditedImage, setRemoveEditedImage] = useState(false);
  const [savingReview, setSavingReview] = useState(false);

  // booking modal states
  const [showModal, setShowModal] = useState(false);
  const [problem, setProblem] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [problemImage, setProblemImage] = useState(null);
  const [problemImagePreview, setProblemImagePreview] = useState("");

  // chat modal states
  const [showChatModal, setShowChatModal] = useState(false);
  const [chatConversationId, setChatConversationId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatContactUnlocked, setChatContactUnlocked] = useState(false);
  const [chatProviderContact, setChatProviderContact] = useState(null);
  const chatEndRef = useRef(null);

  const getTodayIsoLocal = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const getCurrentMinutesLocal = () => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
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

  const parseMeridiemTimeToMinutes = (timeStr) => {
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

  const parseAvailableRange = (rangeStr) => {
    if (!rangeStr || typeof rangeStr !== "string") return null;
    const parts = rangeStr.split("-").map((p) => p.trim());
    if (parts.length !== 2) return null;
    const start = parseMeridiemTimeToMinutes(parts[0]);
    const end = parseMeridiemTimeToMinutes(parts[1]);
    if (start === null || end === null) return null;
    if (end <= start) return null;
    return { start, end };
  };

  const minutesToTimeInput = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const timeInputToLabel = (timeVal) => {
    const [hRaw, mRaw] = String(timeVal || "00:00").split(":");
    let hour = Number(hRaw);
    const minute = Number(mRaw);
    const meridiem = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${String(minute).padStart(2, "0")} ${meridiem}`;
  };

  const buildTimeSlots = (range, stepMinutes = 15) => {
    if (!range) return [];
    const slots = [];
    for (let mins = range.start; mins <= range.end; mins += stepMinutes) {
      const value = minutesToTimeInput(mins);
      slots.push({ value, label: timeInputToLabel(value) });
    }
    return slots;
  };

  const token = localStorage.getItem("customerToken");
  const isLoggedIn = Boolean(token);
  const currentCustomerId = (() => {
    try {
      if (!token) return null;
      const payloadPart = token.split(".")[1];
      if (!payloadPart) return null;
      const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.id || null;
    } catch {
      return null;
    }
  })();

  const startEditReview = (review) => {
    setEditingReviewId(review._id);
    setEditingComment(review.comment || "");
    setEditingRating(Number(review.rating || 5));
    setEditingImage(null);
    setRemoveEditedImage(false);
    setEditingImagePreview(resolveImageUrl(review.image) || "");
  };

  const cancelEditReview = () => {
    setEditingReviewId(null);
    setEditingComment("");
    setEditingRating(5);
    setEditingImage(null);
    setEditingImagePreview("");
    setRemoveEditedImage(false);
  };

  const saveEditedReview = async (reviewId) => {
    if (!token) {
      alert("Please login to edit your review.");
      return;
    }

    const trimmedComment = editingComment.trim();
    if (!trimmedComment) {
      alert("Comment cannot be empty.");
      return;
    }

    try {
      setSavingReview(true);
      const formData = new FormData();
      formData.append("comment", trimmedComment);
      formData.append("rating", String(editingRating));
      formData.append("removeImage", String(removeEditedImage));
      if (editingImage) {
        formData.append("image", editingImage);
      }

      await api.patch(
        `/reviews/${reviewId}`,
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId
            ? {
                ...r,
                comment: trimmedComment,
                rating: editingRating,
                image: editingImage
                  ? r.image
                  : removeEditedImage
                  ? ""
                  : r.image
              }
            : r
        )
      );

      const refresh = await api.get(`/providers/${id}`);
      setReviews(refresh.data.reviews || []);
      setProvider(refresh.data.provider);
      cancelEditReview();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to update review");
    } finally {
      setSavingReview(false);
    }
  };

  /* =========================
     FETCH PROFILE + DISTANCE
  ========================= */
  useEffect(() => {
    const fetchProfileWithLocation = async (lat, lng) => {
      try {
        const res = await api.get(
          `/providers/${id}`,
          {
            params: {
              lat,
              lng
            }
          }
        );

        setProvider(res.data.provider);
        setReviews(res.data.reviews || []);
        setDistanceKm(res.data.distanceKm);
        setFinalPrice(res.data.finalPrice);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const fetchProfileWithoutLocation = async () => {
      try {
        const res = await api.get(
          `/providers/${id}`
        );

        setProvider(res.data.provider);
        setReviews(res.data.reviews || []);
        setFinalPrice(res.data.provider.basePrice || 200);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    };

    const resolveLocation = async () => {
      // 1) Prefer location chosen by user in app
      const storedLocation = localStorage.getItem("userLocation");
      if (storedLocation) {
        try {
          const parsed = JSON.parse(storedLocation);
          if (parsed?.lat && parsed?.lng) {
            return { lat: parsed.lat, lng: parsed.lng };
          }
        } catch (err) {
          console.warn("Failed to parse userLocation", err);
        }
      }

      // 2) If logged in, use customer profile location from DB
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
            return { lat: dbLocation.lat, lng: dbLocation.lng };
          }
        } catch (err) {
          console.warn("Failed to load profile location", err);
        }
      }

      // 3) Last fallback: browser geolocation
      return await new Promise((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    };

    const loadProfile = async () => {
      setLoading(true);
      const resolved = await resolveLocation();
      if (resolved?.lat && resolved?.lng) {
        await fetchProfileWithLocation(resolved.lat, resolved.lng);
      } else {
        await fetchProfileWithoutLocation();
      }
    };

    loadProfile();

    const onLocationChanged = () => {
      loadProfile();
    };
    window.addEventListener("userLocationChanged", onLocationChanged);
    return () => window.removeEventListener("userLocationChanged", onLocationChanged);
  }, [id, token]);

  /* =========================
     BOOK SERVICE
  ========================= */
  const handleBookServiceClick = () => {
    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }
    setShowModal(true);
  };

  const fetchChatMessages = async (conversationId) => {
    const res = await api.get(`/chat/customer/${conversationId}/messages`);
    setChatMessages(res.data?.messages || []);
    setChatContactUnlocked(Boolean(res.data?.contactUnlocked));
    setChatProviderContact(res.data?.providerContact || null);
  };

  const handleOpenChat = async () => {
    if (!isLoggedIn) {
      navigate("/auth");
      return;
    }

    try {
      setShowChatModal(true);
      setChatLoading(true);
      setChatError("");

      const startRes = await api.post(`/chat/customer/start/${provider._id}`);
      const conversationId = startRes.data?.conversationId;

      if (!conversationId) {
        throw new Error("Unable to open conversation");
      }

      setChatConversationId(conversationId);
      await fetchChatMessages(conversationId);
    } catch (err) {
      console.error(err);
      setChatError(err.response?.data?.message || "Failed to open chat");
    } finally {
      setChatLoading(false);
    }
  };

  const handleSendChatMessage = async () => {
    const text = String(chatInput || "").trim();
    if (!text || !chatConversationId) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      senderType: "customer",
      senderId: currentCustomerId,
      text,
      createdAt: new Date().toISOString()
    };

    try {
      setChatSending(true);
      setChatError("");
      setChatMessages((prev) => [...prev, optimistic]);
      setChatInput("");

      const sendRes = await api.post(`/chat/customer/${chatConversationId}/messages`, {
        text
      });

      if (sendRes.data?.message) {
        setChatMessages((prev) => prev.map((m) => (m._id === tempId ? sendRes.data.message : m)));
      }
      if (typeof sendRes.data?.contactUnlocked === "boolean") {
        setChatContactUnlocked(sendRes.data.contactUnlocked);
      }

      await fetchChatMessages(chatConversationId);
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => prev.filter((m) => m._id !== tempId));
      setChatError(err.response?.data?.message || "Failed to send message");
    } finally {
      setChatSending(false);
    }
  };

  useEffect(() => {
    if (!showChatModal) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chatMessages, showChatModal]);

  useEffect(() => {
    if (!showChatModal || !chatConversationId) return undefined;

    const timer = setInterval(() => {
      fetchChatMessages(chatConversationId).catch(() => {
        // Polling errors are non-blocking in UI.
      });
    }, 8000);

    return () => clearInterval(timer);
  }, [showChatModal, chatConversationId]);

  const handleConfirmBooking = async () => {
    if (!token) {
      navigate("/auth");
      return;
    }

    if (!problem || !preferredDate || !preferredTime) {
      alert("Please fill all details");
      return;
    }

    const availableRange = parseAvailableRange(provider?.availableTime);
    if (availableRange) {
      const [h, m] = preferredTime.split(":").map(Number);
      const selectedMinutes = h * 60 + m;
      if (selectedMinutes < availableRange.start || selectedMinutes > availableRange.end) {
        alert(`Please choose a time between ${provider.availableTime}`);
        return;
      }
    }

    if (preferredDate === getTodayIsoLocal()) {
      const selected = timeInputToMinutes(preferredTime);
      const nowMinutes = getCurrentMinutesLocal();
      if (selected !== null && selected < nowMinutes) {
        alert("Please choose a current or future time.");
        return;
      }
    }

    try {
      // include userLocation if available so provider gets accurate address/coords
      const storedLocation = localStorage.getItem("userLocation");
      let location = null;
      if (storedLocation) {
        try { location = JSON.parse(storedLocation); } catch { location = null; }
      }

      const formData = new FormData();
      formData.append("providerId", provider._id);
      formData.append("serviceCategory", provider.serviceCategory || "");
      formData.append("problemDescription", problem);
      formData.append("preferredDate", preferredDate);
      formData.append("preferredTime", preferredTime);
      if (location?.address) formData.append("address", location.address);
      if (location?.locality) formData.append("locality", location.locality);
      if (location?.lat !== undefined && location?.lat !== null) formData.append("lat", String(location.lat));
      if (location?.lng !== undefined && location?.lng !== null) formData.append("lng", String(location.lng));
      if (problemImage) formData.append("problemImage", problemImage);

      await api.post(
        "/customer/requests/create",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      alert("✅ Service request sent to provider!");
      window.dispatchEvent(new Event("customerNotificationsRefresh"));
      setShowModal(false);
      setProblem("");
      setPreferredDate("");
      setPreferredTime("");
      setProblemImage(null);
      setProblemImagePreview("");

    } catch (err) {
      console.error(err);
      const errorMsg = err.response?.data?.message || err.message || "Booking failed";
      alert("❌ " + errorMsg);
    }
  };

  if (loading) return <p className="loading">Loading profile...</p>;
  if (!provider) return <p>Provider not found</p>;

  const availableRange = parseAvailableRange(provider?.availableTime);
  const timeSlots = buildTimeSlots(availableRange);
  const todayIso = getTodayIsoLocal();
  const isTodaySelected = preferredDate === todayIso;
  const currentMinutes = getCurrentMinutesLocal();
  const minTimeToday = getCurrentTimeInputLocal();
  const filteredTimeSlots = isTodaySelected
    ? timeSlots.filter((slot) => {
        const mins = timeInputToMinutes(slot.value);
        return mins !== null && mins >= currentMinutes;
      })
    : timeSlots;

  const resolveMediaUrl = (fileValue) => {
    if (!fileValue || typeof fileValue !== "string") return "";

    const normalized = fileValue.trim().replace(/\\/g, "/");
    if (!normalized) return "";

    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }

    const cleanBase = BACKEND_BASE_URL.replace(/\/$/, "");

    if (normalized.startsWith("/uploads/")) {
      return `${cleanBase}${normalized}`;
    }

    if (normalized.startsWith("uploads/")) {
      return `${cleanBase}/${normalized}`;
    }

    return `${cleanBase}/uploads/${normalized}`;
  };

  const isPdfFile = (fileUrl) => {
    if (!fileUrl) return false;
    const clean = fileUrl.split("?")[0].split("#")[0].toLowerCase();
    return clean.endsWith(".pdf");
  };

  const profilePhotoUrl = resolveMediaUrl(provider?.profilePhoto);
  const certificateUrl = resolveMediaUrl(provider?.skillCertificate);

  return (
    <div className="provider-profile-page">

      {/* ================= BACK BUTTON ================= */}
      <button 
        onClick={() => navigate(-1)} 
        className="back-button"
        title="Go back"
      >
        ← Back
      </button>

      {/* ================= HEADER ================= */}
      <div className="profile-header card">
        <div className="profile-photo-wrapper">
          {profilePhotoUrl ? (
            <img
              src={profilePhotoUrl}
              alt="Profile"
              className="profile-photo large"
            />
          ) : (
            <div className="profile-photo fallback large">
              {provider.name?.[0]}
            </div>
          )}
        </div>

        <div className="profile-info">
          <h1>{provider.name}</h1>
          <span className="badge">
            {provider.serviceCategory === "Other" ? provider.otherService : provider.serviceCategory}
          </span>

          <p className="profile-meta">📍 {provider.address}</p>
          <p className="profile-meta">🛠 {provider.experience} years experience</p>

          {distanceKm !== null && (
            <p className="profile-meta">📏 {distanceKm} km away</p>
          )}
        </div>
      </div>

      {/* ================= PRICE ================= */}
      <div className="price-card card">
        <h3>Starting Price</h3>
        <h1>Starting from ₹{finalPrice}</h1>

        {distanceKm !== null && (
          <p className="subtext">
            Visit charge includes distance for {distanceKm} km. Parts/materials extra if needed.
          </p>
        )}

        <button
          className="book-btn"
          onClick={handleBookServiceClick}
        >
          {isLoggedIn ? "Book Service" : "Login to Book"}
        </button>

        <button
          className="chat-btn"
          onClick={handleOpenChat}
        >
          {isLoggedIn ? "Chat Now" : "Login to Chat"}
        </button>
      </div>

      {/* ================= ABOUT ================= */}
      <div className="card about-card">
        <h3>About</h3>
        <p>{provider.description || "No description provided."}</p>
      </div>

      {/* ================= CERTIFICATE ================= */}
      <div className="card certificate-card">
        <h3>Certification</h3>

        {certificateUrl ? (
          isPdfFile(certificateUrl) ? (
            <a
              href={certificateUrl}
              target="_blank"
              rel="noreferrer"
            >
              📄 View Certificate (PDF)
            </a>
          ) : (
            <img
              src={certificateUrl}
              alt="Certificate"
              className="certificate-image"
            />
          )
        ) : (
          <p>No certificate uploaded.</p>
        )}
      </div>

      {/* ================= REVIEWS ================= */}
      <div className="card reviews-card">
        <h3>Customer Reviews</h3>

        {reviews.length === 0 && <p>No reviews yet.</p>}

        {reviews.map((r) => (
          <div key={r._id} className="review">
            <strong>{r.customer?.name}</strong>
            {editingReviewId === r._id ? (
              <div className="review-edit-box">
                <label className="review-edit-label">Rating</label>
                <select
                  value={editingRating}
                  onChange={(e) => setEditingRating(Number(e.target.value))}
                  disabled={savingReview}
                >
                  {[5, 4, 3, 2, 1].map((star) => (
                    <option key={star} value={star}>
                      {star} Star
                    </option>
                  ))}
                </select>

                <label className="review-edit-label">Comment</label>
                <textarea
                  value={editingComment}
                  onChange={(e) => setEditingComment(e.target.value)}
                  rows={3}
                  disabled={savingReview}
                />

                <label className="review-edit-label">Image</label>
                <input
                  type="file"
                  accept="image/*"
                  disabled={savingReview}
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setEditingImage(file);
                    setRemoveEditedImage(false);
                    if (file) {
                      setEditingImagePreview(URL.createObjectURL(file));
                    }
                  }}
                />
                {editingImagePreview && (
                  <div className="review-image-preview-wrap">
                    <img
                      src={editingImagePreview}
                      alt="Edited review preview"
                      className="review-image"
                    />
                    <button
                      type="button"
                      className="review-remove-image-btn"
                      onClick={() => {
                        setEditingImage(null);
                        setEditingImagePreview("");
                        setRemoveEditedImage(true);
                      }}
                      disabled={savingReview}
                    >
                      Remove Image
                    </button>
                  </div>
                )}

                <div className="review-edit-actions">
                  <button
                    type="button"
                    className="review-save-btn"
                    onClick={() => saveEditedReview(r._id)}
                    disabled={savingReview}
                  >
                    {savingReview ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    className="review-cancel-btn"
                    onClick={cancelEditReview}
                    disabled={savingReview}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{r.comment}</p>
                {r.image && (
                  <img
                    src={resolveImageUrl(r.image)}
                    alt="Review attachment"
                    className="review-image"
                  />
                )}
              </>
            )}
            <span>⭐ {r.rating}/5</span>
            {String(r.customer?._id || "") === String(currentCustomerId || "") &&
              editingReviewId !== r._id && (
                <button
                  type="button"
                  className="review-edit-btn"
                  onClick={() => startEditReview(r)}
                >
                  Edit
                </button>
              )}
          </div>
        ))}
      </div>

     {/* ================= BOOKING MODAL ================= */}
      {showModal && (
        <div className="modal-overlay">
          <div className="booking-modal">
            <h2>Book Service</h2>
            <p className="modal-sub">
              Tell the provider what the issue is
            </p>

            <label>Problem Description</label>
            <textarea
              placeholder="Explain the issue clearly..."
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />

            <label>Problem Image (Optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setProblemImage(file);
                if (!file) {
                  setProblemImagePreview("");
                  return;
                }
                setProblemImagePreview(URL.createObjectURL(file));
              }}
            />
            {problemImagePreview && (
              <div className="problem-image-preview-wrap">
                <img src={problemImagePreview} alt="Problem preview" className="problem-image-preview" />
                <button
                  type="button"
                  className="remove-problem-image-btn"
                  onClick={() => {
                    setProblemImage(null);
                    setProblemImagePreview("");
                  }}
                >
                  Remove Image
                </button>
              </div>
            )}

            <div className="modal-row">
              <div className="modal-col">
                <label>Preferred Date</label>
                <input
                  type="date"
                  value={preferredDate}
                  min={todayIso}
                  onChange={(e) => {
                    const nextDate = e.target.value;
                    setPreferredDate(nextDate);

                    if (!preferredTime) return;
                    if (nextDate !== todayIso) return;

                    const selected = timeInputToMinutes(preferredTime);
                    if (selected !== null && selected < getCurrentMinutesLocal()) {
                      setPreferredTime("");
                    }
                  }}
                />
              </div>

              <div className="modal-col">
                <label>
                  Preferred Time
                  {provider?.availableTime && (
                    <span className="time-hint">
                      Available: {provider.availableTime}
                    </span>
                  )}
                </label>
                {availableRange ? (
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                  >
                    <option value="">Select time</option>
                    {filteredTimeSlots.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    step={900}
                    min={isTodaySelected ? minTimeToday : undefined}
                  />
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="cancel-btn"
                onClick={() => {
                  setShowModal(false);
                  setProblemImage(null);
                  setProblemImagePreview("");
                }}
              >
                Cancel
              </button>

              <button
                className="confirm-btn"
                onClick={handleConfirmBooking}
              >
                Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {showChatModal && (
        <div className="chat-modal-overlay">
          <div className="chat-modal-card">
            <div className="chat-modal-header">
              <div className="chat-modal-header-left">
                <div className="chat-modal-avatar">
                  {provider.name?.charAt(0).toUpperCase() || "S"}
                </div>
                <div className="chat-modal-header-text">
                  <span className="chat-modal-header-label">Service Provider</span>
                  <h2>{provider.name}</h2>
                </div>
              </div>
              <button
                className="chat-close-btn"
                onClick={() => {
                  setShowChatModal(false);
                  setChatError("");
                }}
                type="button"
              >
                ✕
              </button>
            </div>

            {!chatContactUnlocked && (
              <div className="chat-warning-banner">
                Contact sharing is blocked before booking. Examples: 98XXXXXX10, user@example.com, WhatsApp/Telegram handle.
              </div>
            )}

            {chatContactUnlocked && chatProviderContact && (
              <div className="chat-unlocked-banner">
                Contact unlocked: {chatProviderContact.mobile || "-"} {chatProviderContact.email ? `| ${chatProviderContact.email}` : ""}
              </div>
            )}

            <div className="chat-message-list">
              {chatLoading ? (
                <p className="chat-muted">Loading chat...</p>
              ) : chatMessages.length === 0 ? (
                <p className="chat-muted">No messages yet. Start the conversation.</p>
              ) : (
                chatMessages.map((msg) => (
                  <div
                    key={msg._id}
                    className={`chat-bubble ${msg.senderType === "customer" ? "chat-bubble-me" : msg.senderType === "system" ? "chat-bubble-system" : "chat-bubble-other"}`}
                  >
                    <div className="chat-bubble-text">{msg.text}</div>
                    <div className="chat-bubble-time">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {chatError && <div className="chat-error-box">{chatError}</div>}

            <div className="chat-input-row">
              <input
                type="text"
                placeholder="Type your message"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSendChatMessage();
                  }
                }}
              />
              <button
                type="button"
                className="chat-send-btn"
                onClick={handleSendChatMessage}
                disabled={chatSending}
              >
                {chatSending ? "Sending..." : "Send"}
              </button>
            </div>

            <div className="chat-modal-actions">
              <button
                type="button"
                className="book-btn"
                onClick={() => {
                  setShowChatModal(false);
                  handleBookServiceClick();
                }}
              >
                Book Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
