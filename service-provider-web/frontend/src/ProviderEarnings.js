import React, { useState, useEffect } from "react";
import api from "./config/axios";
import "./ProviderStyles.css";
import Loader from "../components/Loader";
import OverlayLoader from "../components/OverlayLoader";

const ProviderEarnings = () => {
  const [earnings, setEarnings] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("summary"); // summary or history

  const token = localStorage.getItem("providerToken");

  useEffect(() => {
    fetchEarnings();
    if (tab === "history") {
      fetchHistory();
    }
  }, [tab]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const res = await api.get("/provider/earnings/summary", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setEarnings(res.data.earnings);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error fetching earnings");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await api.get("/provider/earnings/history", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setHistory(res.data.history);
      }
    } catch (err) {
      console.error("Error fetching history:", err);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${Math.round(amount || 0).toLocaleString("en-IN")}`;
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  };

  if (loading) {
    return <Loader text="Loading earnings..." />;
  }

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
          💰 My Earnings
        </h1>
        <p style={{ color: "#6b7280" }}>Track your payments and payout status</p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "0.5rem",
            padding: "1rem",
            marginBottom: "1.5rem"
          }}
        >
          <p style={{ color: "#dc2626" }}>{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      {earnings && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1rem",
            marginBottom: "2rem"
          }}
        >
          {/* Total Earned */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "1.5rem"
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
              Total Earned (All Time)
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#2563eb",
                marginBottom: "0.5rem"
              }}
            >
              {formatCurrency(earnings.totalEarned)}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {earnings.totalBookings} completed bookings
            </p>
          </div>

          {/* Pending Payout */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "1.5rem"
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
              ⏳ Pending Payout
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#f59e0b",
                marginBottom: "0.5rem"
              }}
            >
              {formatCurrency(earnings.pendingPayout)}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {earnings.pendingCount} bookings awaiting settlement
            </p>
          </div>

          {/* Paid Earnings */}
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "0.75rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              padding: "1.5rem"
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "0.5rem" }}>
              ✓ Paid Earnings
            </p>
            <p
              style={{
                fontSize: "2rem",
                fontWeight: "bold",
                color: "#10b981",
                marginBottom: "0.5rem"
              }}
            >
              {formatCurrency(earnings.paidEarnings)}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              {earnings.paidCount} payments received
            </p>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div
        style={{
          backgroundColor: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: "0.5rem",
          padding: "1rem",
          marginBottom: "2rem"
        }}
      >
        <p style={{ fontSize: "0.875rem", color: "#1e40af" }}>
          <strong>📌 Note:</strong> Platform commission is 10%. You receive 90% of the service amount.
          Pending payouts will be transferred to your bank account by the admin.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: "1.5rem", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setTab("summary")}
            style={{
              padding: "0.75rem 1rem",
              fontWeight: "500",
              borderBottom: tab === "summary" ? "2px solid #2563eb" : "none",
              color: tab === "summary" ? "#2563eb" : "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            Summary
          </button>
          <button
            onClick={() => setTab("history")}
            style={{
              padding: "0.75rem 1rem",
              fontWeight: "500",
              borderBottom: tab === "history" ? "2px solid #2563eb" : "none",
              color: tab === "history" ? "#2563eb" : "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer"
            }}
          >
            Earnings History
          </button>
        </div>
      </div>

      {/* Earnings History Table */}
      {tab === "history" && (
        <div>
          {history.length === 0 ? (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                padding: "2rem",
                textAlign: "center"
              }}
            >
              <p style={{ color: "#6b7280" }}>No earnings history yet</p>
            </div>
          ) : (
            <div
              style={{
                backgroundColor: "#fff",
                borderRadius: "0.5rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                overflowX: "auto"
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ backgroundColor: "#f9fafb" }}>
                  <tr>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "left",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Date
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "left",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Service
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "left",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Customer
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Total
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Commission
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "right",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      You Earned
                    </th>
                    <th
                      style={{
                        padding: "0.75rem 1rem",
                        textAlign: "left",
                        fontSize: "0.875rem",
                        fontWeight: "500",
                        color: "#374151",
                        borderBottom: "1px solid #e5e7eb"
                      }}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item, idx) => (
                    <tr key={item.bookingId} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", color: "#374151" }}>
                        {formatDate(item.serviceDate)}
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", color: "#374151" }}>
                        {item.serviceCategory}
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem", color: "#6b7280" }}>
                        {item.customerName}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.875rem",
                          color: "#374151",
                          textAlign: "right",
                          fontWeight: "500"
                        }}
                      >
                        {formatCurrency(item.totalAmount)}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.875rem",
                          color: "#dc2626",
                          textAlign: "right"
                        }}
                      >
                        {formatCurrency(item.commission)}
                      </td>
                      <td
                        style={{
                          padding: "1rem",
                          fontSize: "0.875rem",
                          color: "#10b981",
                          textAlign: "right",
                          fontWeight: "600"
                        }}
                      >
                        {formatCurrency(item.earning)}
                      </td>
                      <td style={{ padding: "1rem", fontSize: "0.875rem" }}>
                        {item.payoutStatus === "paid" ? (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.75rem",
                              backgroundColor: "#d1fae5",
                              color: "#065f46",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600"
                            }}
                          >
                            ✓ Paid
                            {item.payoutDate && (
                              <span style={{ display: "block", fontSize: "0.625rem", marginTop: "2px" }}>
                                {formatDate(item.payoutDate)}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span
                            style={{
                              display: "inline-block",
                              padding: "0.25rem 0.75rem",
                              backgroundColor: "#fef3c7",
                              color: "#92400e",
                              borderRadius: "9999px",
                              fontSize: "0.75rem",
                              fontWeight: "600"
                            }}
                          >
                            ⏳ Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderEarnings;
