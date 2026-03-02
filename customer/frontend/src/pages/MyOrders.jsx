import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import { convertTo12HourFormat } from "../utils/timeUtils";
import "../styles/MyOrders.css";

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);

  // review modal
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackImage, setFeedbackImage] = useState(null);
  const [feedbackPreview, setFeedbackPreview] = useState("");

  const token = localStorage.getItem("customerToken");

  const getScheduledVisitLabel = (order) => {
    if (order?.visitDate && order?.visitTime) {
      return `${order.visitDate} at ${convertTo12HourFormat(order.visitTime)}`;
    }
    if (order?.preferredDate && order?.preferredTime) {
      return `${order.preferredDate} at ${convertTo12HourFormat(order.preferredTime)}`;
    }
    return "Waiting for provider";
  };

  /* ================= FETCH ORDERS ================= */
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await api.get(
          "/customer/requests/my-requests",
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        setOrders(res.data);
      } catch (err) {
        console.error("Fetch orders error", err);
      }
    };

    fetchOrders();
  }, [token]);

  /* ================= SUBMIT REVIEW ================= */
  const submitReview = async () => {
    if (!comment.trim()) {
      alert("Please write a comment");
      return;
    }

    try {
      const providerId =
        typeof activeOrder?.providerId === "object"
          ? activeOrder?.providerId?._id
          : activeOrder?.providerId;

      if (!providerId) {
        alert("Provider information is missing for this booking.");
        return;
      }

      const formData = new FormData();
      formData.append("providerId", String(providerId));
      formData.append("bookingId", activeOrder._id);
      formData.append("rating", String(rating));
      formData.append("comment", comment);
      if (feedbackImage) {
        formData.append("image", feedbackImage);
      }

      await api.post("/reviews/create", formData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      alert("Feedback submitted successfully!");
      setOrders((prev) =>
        prev.map((o) =>
          o._id === activeOrder._id
            ? { ...o, reviewed: true, reviewedAt: new Date().toISOString() }
            : o
        )
      );
      setShowReview(false);
      setActiveOrder(null);
      setRating(5);
      setComment("");
      setFeedbackImage(null);
      setFeedbackPreview("");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to submit feedback");
    }
  };

  return (
    <div className="orders-page">
      <button
        onClick={() => navigate(-1)}
        className="back-button"
        title="Go back"
      >
        {"<-"} Back
      </button>

      <h1 className="orders-title">My Orders</h1>
      <p className="orders-subtitle">Track and manage your service bookings</p>

      {orders.length === 0 && (
        <div className="orders-empty-state">
          <h3>No bookings yet</h3>
          <p>Your confirmed and completed bookings will appear here.</p>
        </div>
      )}

      {orders.map((o) => (
        <div key={o._id} className={`order-card ${o.status}`}>
          <div className="order-header">
            <h3>
              {o.serviceCategory} - {o.providerName}
            </h3>

            <span className={`status-pill ${o.status}`}>{o.status.toUpperCase()}</span>
          </div>

          <p>
            <b>Problem:</b> {o.problemDescription}
          </p>

          <p>
            <b>Scheduled Visit:</b>{" "}
            {getScheduledVisitLabel(o)}
          </p>

          {o.providerNote && (
            <p>
              <b>Provider Note:</b> {o.providerNote}
            </p>
          )}

          {o.status === "cancelled" && (
            <p className="cancelled-note">This booking was cancelled by provider.</p>
          )}

          <div className="order-actions">
            <button className="track-btn" onClick={() => setActiveOrder(o)}>
              Track Booking
            </button>

            {o.status === "completed" && !o.reviewed && (
              <button
                className="review-btn"
                onClick={() => {
                  setActiveOrder(o);
                  setFeedbackImage(null);
                  setFeedbackPreview("");
                  setShowReview(true);
                }}
              >
                Leave Review
              </button>
            )}

            {o.status === "cancelled" && !o.reviewed && (
              <button
                className="feedback-btn"
                onClick={() => {
                  setActiveOrder(o);
                  setFeedbackImage(null);
                  setFeedbackPreview("");
                  setShowReview(true);
                }}
              >
                Give Feedback
              </button>
            )}

            {(o.status === "completed" || o.status === "cancelled") && o.reviewed && (
              <span className="feedback-done">Feedback submitted</span>
            )}
          </div>
        </div>
      ))}

      {activeOrder && !showReview && (
        <Modal onClose={() => setActiveOrder(null)}>
          <h2>Booking Status</h2>
          <Timeline status={activeOrder.status} />

          <p>
            <b>Problem:</b> {activeOrder.problemDescription}
          </p>

          <p>
            <b>Scheduled:</b>{" "}
            {getScheduledVisitLabel(activeOrder)}
          </p>

          {activeOrder.providerNote && (
            <p>
              <b>Provider Note:</b> {activeOrder.providerNote}
            </p>
          )}

          {activeOrder.status === "cancelled" && (
            <div className="cancelled-banner">Booking cancelled by provider.</div>
          )}
        </Modal>
      )}

      {showReview && (
        <Modal
          onClose={() => {
            setShowReview(false);
            setRating(5);
            setComment("");
          }}
        >
          <h2>Share Feedback</h2>

          <label>Rating</label>
          <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r} Star
              </option>
            ))}
          </select>

          <label>Comment</label>
          <textarea
            placeholder="Share your experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />

          <label>Optional Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              setFeedbackImage(file);
              if (file) {
                setFeedbackPreview(URL.createObjectURL(file));
              } else {
                setFeedbackPreview("");
              }
            }}
          />

          {feedbackPreview && (
            <div className="feedback-image-preview">
              <img src={feedbackPreview} alt="Feedback attachment preview" />
              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  setFeedbackImage(null);
                  setFeedbackPreview("");
                }}
              >
                Remove Image
              </button>
            </div>
          )}

          <button className="confirm-btn" onClick={submitReview}>
            Submit Feedback
          </button>
        </Modal>
      )}
    </div>
  );
}

function Timeline({ status }) {
  const steps =
    status === "cancelled"
      ? ["pending", "accepted", "cancelled"]
      : ["pending", "accepted", "in_progress", "completed"];

  return (
    <div className="timeline">
      {steps.map((s, i) => (
        <div key={s} className="timeline-step">
          <div className={`dot ${steps.indexOf(status) >= i ? "active" : ""}`} />
          <span>{s.replace("_", " ").toUpperCase()}</span>
        </div>
      ))}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {children}
        <button className="close-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
