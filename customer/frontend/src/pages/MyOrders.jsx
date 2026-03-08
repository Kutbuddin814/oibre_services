import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import { convertTo12HourFormat } from "../utils/timeUtils";
import PaymentModal from "../components/PaymentModal";
import "../styles/MyOrders.css";
import "../styles/unified-modal.css";
import "../styles/unified-forms.css";
import "../styles/unified-buttons.css";

export default function MyOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const [approvePriceLoadingId, setApprovePriceLoadingId] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetOrder, setPaymentTargetOrder] = useState(null);

  // review modal
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [feedbackImage, setFeedbackImage] = useState(null);
  const [feedbackPreview, setFeedbackPreview] = useState("");

  const token = localStorage.getItem("customerToken");

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
    fetchOrders();
  }, [token]);

  const approveFinalPrice = async (order) => {
    try {
      setApprovePriceLoadingId(order._id);
      await api.put(
        `/customer/requests/approve-price/${order._id}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setOrders((prev) =>
        prev.map((o) =>
          o._id === order._id
            ? { ...o, priceStatus: "price_approved", priceApprovedAt: new Date().toISOString() }
            : o
        )
      );

      alert("Final price approved. Provider can now start service.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve final price.");
    } finally {
      setApprovePriceLoadingId(null);
    }
  };

  const openPayment = (order) => {
    setPaymentTargetOrder(order);
    setShowPaymentModal(true);
  };

  const onPaymentSuccess = async () => {
    await fetchOrders();
  };

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

  const canCancelOrder = (order) => {
    if (!order?.status) return false;
    return !["completed", "cancelled"].includes(order.status);
  };

  const openCancelModal = (order) => {
    setActiveOrder(order);
    setCancelReason("");
    setShowCancelModal(true);
  };

  const submitCancellation = async () => {
    if (!activeOrder?._id) return;

    const reason = cancelReason.trim();
    if (!reason) {
      alert("Please enter a cancellation reason.");
      return;
    }

    try {
      setCancelLoading(true);
      const res = await api.put(
        `/customer/requests/cancel/${activeOrder._id}`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const updated = res.data?.request;

      setOrders((prev) =>
        prev.map((order) =>
          order._id === activeOrder._id
            ? {
                ...order,
                status: "cancelled",
                customerCancelReason: updated?.customerCancelReason || reason
              }
            : order
        )
      );

      setActiveOrder((prev) =>
        prev ? { ...prev, status: "cancelled", customerCancelReason: updated?.customerCancelReason || reason } : prev
      );
      setShowCancelModal(false);
      setActiveOrder(null);
      setCancelReason("");
      alert("Booking cancelled. Provider has been notified by email.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to cancel booking");
    } finally {
      setCancelLoading(false);
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

          {o.finalPrice && (
            <p>
              <b>Final Price:</b> Rs {o.finalPrice}
            </p>
          )}

          {o.priceStatus === "price_sent" && (
            <p style={{ color: "#b45309", fontWeight: 600 }}>
              Provider sent final quote. Please approve to continue.
            </p>
          )}

          {o.priceStatus === "price_approved" && (
            <p style={{ color: "#15803d", fontWeight: 600 }}>
              Final quote approved.
            </p>
          )}

          {o.status === "cancelled" && (
            <p className="cancelled-note">
              {o.customerCancelReason
                ? "This booking was cancelled by you."
                : "This booking was cancelled by provider."}
            </p>
          )}

          <div className="order-actions">
            <button className="track-btn" onClick={() => setActiveOrder(o)}>
              Track Booking
            </button>

            {canCancelOrder(o) && (
              <button className="cancel-btn" onClick={() => openCancelModal(o)}>
                Cancel Booking
              </button>
            )}

            {o.priceStatus === "price_sent" && (
              <button
                className="track-btn"
                onClick={() => approveFinalPrice(o)}
                disabled={approvePriceLoadingId === o._id}
              >
                {approvePriceLoadingId === o._id ? "Approving..." : "Approve Final Price"}
              </button>
            )}

            {o.status === "completed" && o.priceStatus === "price_approved" && o.paymentStatus === "pending" && (
              <button className="review-btn" onClick={() => openPayment(o)}>
                Pay Now
              </button>
            )}

            {o.status === "completed" && ["cod_paid", "online_paid"].includes(o.paymentStatus) && (
              <span className="feedback-done">Payment Done ({o.paymentStatus.replace("_", " ")})</span>
            )}

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

      {activeOrder && !showReview && !showCancelModal && (
        <Modal onClose={() => setActiveOrder(null)} title="Booking Status">
          <Timeline status={activeOrder.status} priceStatus={activeOrder.priceStatus} />

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

            {activeOrder.finalPrice && (
              <div style={{ marginBottom: "12px" }}>
                <strong>Final Price:</strong>
                <p style={{ margin: "4px 0 0" }}>Rs {activeOrder.finalPrice}</p>
              </div>
            )}

            {activeOrder.priceStatus === "price_sent" && (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={() => approveFinalPrice(activeOrder)}
                disabled={approvePriceLoadingId === activeOrder._id}
              >
                {approvePriceLoadingId === activeOrder._id ? "Approving..." : "Approve Final Price"}
              </button>
            )}

            {activeOrder.status === "completed" && activeOrder.priceStatus === "price_approved" && activeOrder.paymentStatus === "pending" && (
              <button
                className="btn btn-primary"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={() => openPayment(activeOrder)}
              >
                Pay Now
              </button>
            )}

            {activeOrder.status === "cancelled" && (
              <div className="modal-message warning">
                <span>⚠️</span>
                <span>
                  {activeOrder.customerCancelReason
                    ? "Booking cancelled by you."
                    : "Booking cancelled by provider."}
                </span>
              </div>
            )}

            {activeOrder.customerCancelReason && (
              <div style={{ marginBottom: "12px" }}>
                <strong>Cancellation Reason:</strong>
                <p style={{ margin: "4px 0 0" }}>{activeOrder.customerCancelReason}</p>
              </div>
            )}

            {canCancelOrder(activeOrder) && (
              <button
                className="btn btn-danger"
                style={{ width: "100%", marginTop: "8px" }}
                onClick={() => openCancelModal(activeOrder)}
              >
                Cancel Booking
              </button>
            )}
          </div>
        </Modal>
      )}

      {showCancelModal && activeOrder && (
        <Modal
          onClose={() => {
            if (cancelLoading) return;
            setShowCancelModal(false);
            setActiveOrder(null);
            setCancelReason("");
          }}
          title="Cancel Booking"
          subtitle="Tell us why you want to cancel. This will be emailed to the service provider."
          footer={
            <button
              className="btn btn-danger"
              style={{ width: "100%" }}
              onClick={submitCancellation}
              disabled={cancelLoading}
            >
              {cancelLoading ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          }
        >
          <div className="form">
            <div className="modal-field">
              <label className="modal-field-label">Reason</label>
              <textarea
                className="modal-field-textarea"
                placeholder="Please tell us why you are cancelling this service"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
        </Modal>
      )}

      {showReview && (
        <Modal
          onClose={() => {
            setShowReview(false);
            setActiveOrder(null);
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

      <PaymentModal
        isOpen={showPaymentModal}
        serviceRequest={paymentTargetOrder}
        onClose={() => {
          setShowPaymentModal(false);
          setPaymentTargetOrder(null);
        }}
        onSuccess={onPaymentSuccess}
      />
    </div>
  );
}

function Timeline({ status, priceStatus }) {
  const steps =
    status === "cancelled"
      ? ["pending", "accepted", "cancelled"]
      : ["pending", "accepted", "price_sent", "price_approved", "in_progress", "completed"];

  const getCurrentStep = () => {
    if (status === "cancelled") return "cancelled";
    if (status === "completed") return "completed";
    if (status === "in_progress") return "in_progress";
    if (priceStatus === "price_approved") return "price_approved";
    if (priceStatus === "price_sent") return "price_sent";
    return status;
  };

  const currentStep = getCurrentStep();

  return (
    <div className="timeline">
      {steps.map((s, i) => (
        <div key={s} className="timeline-step">
          <div className={`dot ${steps.indexOf(currentStep) >= i ? "active" : ""}`} />
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
