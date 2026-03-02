import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../config/axios";
import "../styles/providerProfile.css";

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
    setEditingImagePreview(review.image || "");
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

      await axios.patch(
        `http://localhost:5000/api/reviews/${reviewId}`,
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

      const refresh = await axios.get(`http://localhost:5000/api/providers/${id}`);
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
        const res = await axios.get(
          `http://localhost:5000/api/providers/${id}`,
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
        const res = await axios.get(
          `http://localhost:5000/api/providers/${id}`
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
          const profile = await axios.get("http://localhost:5000/api/customers/profile", {
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
        try { location = JSON.parse(storedLocation); } catch(e) { location = null; }
      }

      await axios.post(
        "http://localhost:5000/api/customer/requests/create",
        {
          providerId: provider._id,
          serviceCategory: provider.serviceCategory,
          problemDescription: problem,
          preferredDate,
          preferredTime,
          address: location?.address,
          locality: location?.locality,
          lat: location?.lat,
          lng: location?.lng
        },
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

    } catch (err) {
      console.error(err);
      alert("❌ Booking failed");
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
          {provider.profilePhoto ? (
            <img
              src={`http://localhost:5000/uploads/${provider.profilePhoto}`}
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
        <h3>Service Price</h3>
        <h1>₹{finalPrice}</h1>

        {distanceKm !== null && (
          <p className="subtext">
            Includes distance charges ({distanceKm} km)
          </p>
        )}

        <button
          className="book-btn"
          onClick={handleBookServiceClick}
        >
          {isLoggedIn ? "Book Service" : "Login to Book"}
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

        {provider.skillCertificate ? (
          provider.skillCertificate.endsWith(".pdf") ? (
            <a
              href={`http://localhost:5000/uploads/${provider.skillCertificate}`}
              target="_blank"
              rel="noreferrer"
            >
              📄 View Certificate (PDF)
            </a>
          ) : (
            <img
              src={`http://localhost:5000/uploads/${provider.skillCertificate}`}
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
                    src={`http://localhost:5000/uploads/${r.image}`}
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

            <div className="modal-row">
              <div>
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

              <div>
                <label>Preferred Time</label>
                {provider?.availableTime && (
                  <div className="time-hint">
                    Available: {provider.availableTime}
                  </div>
                )}
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
                onClick={() => setShowModal(false)}
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
    </div>
  );
}
