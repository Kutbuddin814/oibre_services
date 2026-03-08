import React, { useState, useEffect } from "react";
import api from "../api";
import "../styles/AdminPayoutsPanel.css";

const AdminPayoutsPanel = () => {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);
  const [tab, setTab] = useState("pending"); // pending or history
  const [markedPaidId, setMarkedPaidId] = useState(null);
  const token = localStorage.getItem("adminToken");

  const adminName = localStorage.getItem("adminName") || "Admin";

  useEffect(() => {
    fetchPayouts();
    fetchSummary();
  }, [tab]);

  useEffect(() => {
    if (!token) return undefined;

    const refreshAll = () => {
      if (document.visibilityState === "visible") {
        fetchPayouts();
        fetchSummary();
      }
    };

    window.addEventListener("focus", refreshAll);
    document.addEventListener("visibilitychange", refreshAll);

    return () => {
      window.removeEventListener("focus", refreshAll);
      document.removeEventListener("visibilitychange", refreshAll);
    };
  }, [token, tab]);

  const fetchPayouts = async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint =
        tab === "pending"
          ? "/admin/payouts/pending"
          : "/admin/payouts/history";

      const res = await api.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setPayouts(res.data.payouts);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching payouts");
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get("/admin/payouts/summary", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Error fetching summary:", err);
    }
  };

  const handleMarkAsPaid = async (bookingId) => {
    if (
      !window.confirm(
        "I confirm that I have transferred the amount via bank/UPI. Mark as paid?"
      )
    ) {
      return;
    }

    setMarkedPaidId(bookingId);

    try {
      const res = await api.put(
        `/admin/payouts/${bookingId}/mark-paid`,
        { adminName: adminName },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data.success) {
        alert("Payout marked as paid successfully!");
        await fetchPayouts();
        await fetchSummary();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Error marking payout as paid");
    } finally {
      setMarkedPaidId(null);
    }
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN");
  };

  const formatCurrency = (amount) => {
    return `₹${Math.round(amount).toLocaleString("en-IN")}`;
  };

  if (loading && tab === "pending") {
    return (
      <div className="payouts-loading">
        <div className="payouts-spinner" />
        <div className="payouts-loading-text">Loading payouts...</div>
      </div>
    );
  }

  return (
    <div className="payouts-page">
      <div className="payouts-header">
        <h1 className="payouts-title">Payout Management</h1>
        <p className="payouts-subtitle">Manage provider payments and settlements</p>
      </div>

      {summary && (
        <div className="payouts-summary-grid">
          <div className="payouts-card">
            <p className="payouts-card-label">Total Revenue</p>
            <p className="payouts-card-value value-blue">
              {formatCurrency(summary.totalRevenue)}
            </p>
            <p className="payouts-card-note">
              {summary.bookingCount} completed bookings
            </p>
          </div>

          <div className="payouts-card">
            <p className="payouts-card-label">Our Commission (10%)</p>
            <p className="payouts-card-value value-green">
              {formatCurrency(summary.totalCommission)}
            </p>
          </div>

          <div className="payouts-card">
            <p className="payouts-card-label">Provider Earnings</p>
            <p className="payouts-card-value value-violet">
              {formatCurrency(summary.totalProviderEarnings)}
            </p>
          </div>

          <div className="payouts-card">
            <p className="payouts-card-label">Status</p>
            <div className="payouts-status-list">
              <span className="status-pill status-pending">Pending: {summary.pendingPayoutsCount}</span>
              <span className="status-pill status-paid">Paid: {summary.paidPayoutsCount}</span>
            </div>
          </div>
        </div>
      )}

      <div className="payouts-tabs-wrap">
        <div className="payouts-tabs">
          <button
            onClick={() => setTab("pending")}
            className={`payouts-tab ${tab === "pending" ? "active" : ""}`}
          >
            Pending Payouts ({summary?.pendingPayoutsCount || 0})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`payouts-tab ${tab === "history" ? "active" : ""}`}
          >
            Settlement History ({summary?.paidPayoutsCount || 0})
          </button>
        </div>
      </div>

      {error && (
        <div className="payouts-error-box">
          <p>{error}</p>
        </div>
      )}

      {payouts.length === 0 ? (
        <div className="payouts-empty">
          <p>
            {tab === "pending" ? "No pending payouts" : "No settlement history"}
          </p>
        </div>
      ) : (
        <div className="payouts-table-shell">
          <div className="payouts-table-wrap">
            <table className="payouts-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Provider</th>
                  <th>Service</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right">Commission (10%)</th>
                  <th className="text-right">Provider Gets</th>
                  {tab === "history" && (
                    <th>Paid On</th>
                  )}
                  <th>Payment Details</th>
                  {tab === "pending" && (
                    <th>Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout._id}>
                    <td className="booking-id-cell">
                      {payout.bookingId.slice(0, 8)}...
                    </td>
                    <td>
                      <div className="provider-name">{payout.providerName}</div>
                      <span className="provider-email">
                        {payout.providerEmail}
                      </span>
                    </td>
                    <td>
                      {payout.serviceCategory}
                    </td>
                    <td className="text-right amount-cell">
                      {formatCurrency(payout.totalAmount)}
                    </td>
                    <td className="text-right commission-cell">
                      {formatCurrency(payout.commission)}
                    </td>
                    <td className="text-right earning-cell">
                      {formatCurrency(payout.providerEarning)}
                    </td>
                    {tab === "history" && (
                      <td>
                        {formatDate(payout.payoutDate)}
                      </td>
                    )}
                    <td>
                      {payout.paymentDetailsCompleted ? (
                        <div className="payment-status ok">Complete</div>
                      ) : (
                        <div className="payment-status bad">Incomplete</div>
                      )}
                      {payout.paymentDetails?.accountNumber && (
                        <p className="payment-meta">
                          {payout.paymentDetails.accountNumber.slice(-4).padStart(4, "*")} •{" "}
                          {payout.paymentDetails.ifscCode}
                        </p>
                      )}
                    </td>
                    {tab === "pending" && (
                      <td>
                        {payout.canPay ? (
                          <button
                            onClick={() => handleMarkAsPaid(payout.bookingId)}
                            disabled={markedPaidId === payout.bookingId}
                            className="mark-paid-btn"
                          >
                            {markedPaidId === payout.bookingId
                              ? "Processing..."
                              : "Mark Paid"}
                          </button>
                        ) : (
                          <div className="incomplete-note">Details incomplete</div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayoutsPanel;
