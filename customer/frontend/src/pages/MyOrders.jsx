import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import { convertTo12HourFormat } from "../utils/timeUtils";
import "../styles/MyOrders.css";
import "../styles/unified-modal.css";
import "../styles/unified-forms.css";
import "../styles/unified-buttons.css";

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
        <Modal onClose={() => setActiveOrder(null)} title="Booking Status">
          <Timeline status={activeOrder.status} />

          <div style={{ marginTop: "16px" }}>
            <div style={{ marginBottom: "12px" }}>
              <strong>Problem:</strong>
              <p style={{ margin: "4px 0 0" }}>{activeOrder.problemDescription}</p>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <strong>Scheduled:</strong>
              <p style={{ margin: "4px 0 0" }}>
                {getScheduledVisitLabel(activeOrder)}
              </p>
            </div>

            {activeOrder.providerNote && (
              <div style={{ marginBottom: "12px" }}>
                <strong>Provider Note:</strong>
                <p style={{ margin: "4px 0 0" }}>{activeOrder.providerNote}</p>
              </div>
            )}

            {activeOrder.status === "cancelled" && (
              <div className="modal-message warning">
                <span>⚠️</span>
                <span>Booking cancelled by provider.</span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showReview && (
        <Modal
          onClose={() => {
            setShowReview(false);
            setRating(5);
            setComment("");
          }}
          title="Share Feedback"
          footer={
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={submitReview}>
              Submit Feedback
            </button>
          }
        >
          <div className="form">
            <div className="modal-field">
              <label className="modal-field-label">Rating</label>
              <select className="modal-field-select" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((r) => (
                  <option key={r} value={r}>
                    {r} Star{r !== 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-field">
              <label className="modal-field-label">Comment</label>
              <textarea
                className="modal-field-textarea"
                placeholder="Share your experience..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            <div className="modal-field">
              <label className="modal-field-label">Optional Image</label>
              <input
                type="file"
                className="modal-field-input"
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
            </div>

            {feedbackPreview && (
              <div style={{
                marginBottom: "16px",
                padding: "12px",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                position: "relative"
              }}>
                <img src={feedbackPreview} alt="Feedback preview" style={{
                  maxWidth: "100%",
                  borderRadius: "8px",
                  maxHeight: "200px"
                }} />
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => {
                    setFeedbackImage(null);
                    setFeedbackPreview("");
                  }}
                  style={{ marginTop: "8px", width: "100%" }}
                >
                  Remove Image
                </button>
              </div>
            )}
          </div>
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

function Modal({ children, onClose, title, subtitle, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="modal-header">
            <div className="modal-header-content">
              <h2 className="modal-title">{title}</h2>
              {subtitle && <p className="modal-subtitle">{subtitle}</p>}
            </div>
            <button className="modal-close-button" onClick={onClose}>
              ✕
            </button>
          </div>
        )}
        <div className="modal-body">
          {children}
        </div>
        {footer && (
          <div className="modal-footer">
            {typeof footer === 'function' ? footer() : footer}
          </div>
        )}
      </div>
    </div>
  );
}
