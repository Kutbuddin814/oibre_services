import React, { useState, useEffect } from "react";
import axios from "axios";

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

  const fetchPayouts = async () => {
    setLoading(true);
    setError("");

    try {
      const endpoint =
        tab === "pending"
          ? "/api/admin/payouts/pending"
          : "/api/admin/payouts/history";

      const res = await axios.get(endpoint, {
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
      const res = await axios.get("/api/admin/payouts/summary", {
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
      const res = await axios.put(
        `/api/admin/payouts/${bookingId}/mark-paid`,
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
      <div className="p-8 text-center">
        <div className="text-lg font-medium text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payout Management</h1>
        <p className="text-gray-600">Manage provider payments and settlements</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(summary.totalRevenue)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              {summary.bookingCount} completed bookings
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Our Commission (10%)</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalCommission)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Provider Earnings</p>
            <p className="text-2xl font-bold text-purple-600">
              {formatCurrency(summary.totalProviderEarnings)}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm text-gray-600 mb-1">Status</p>
            <p className="text-sm font-medium mt-2">
              <span className="text-orange-600">
                ⏳ Pending: {summary.pendingPayoutsCount}
              </span>
              <br />
              <span className="text-green-600">
                ✓ Paid: {summary.paidPayoutsCount}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-4">
          <button
            onClick={() => setTab("pending")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "pending"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Pending Payouts ({summary?.pendingPayoutsCount || 0})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`px-4 py-2 font-medium border-b-2 transition-colors ${
              tab === "history"
                ? "text-blue-600 border-blue-600"
                : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Settlement History ({summary?.paidPayoutsCount || 0})
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Table */}
      {payouts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">
            {tab === "pending" ? "No pending payouts" : "No settlement history"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Booking ID
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Provider
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Service
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                    Commission (10%)
                  </th>
                  <th className="px-6 py-3 text-right text-sm font-medium text-gray-700">
                    Provider Gets
                  </th>
                  {tab === "history" && (
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Paid On
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                    Payment Details
                  </th>
                  {tab === "pending" && (
                    <th className="px-6 py-3 text-left text-sm font-medium text-gray-700">
                      Action
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {payouts.map((payout) => (
                  <tr key={payout._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {payout.bookingId.slice(0, 8)}...
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {payout.providerName}
                      <br />
                      <span className="text-xs text-gray-500">
                        {payout.providerEmail}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {payout.serviceCategory}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 text-right">
                      {formatCurrency(payout.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 text-right">
                      {formatCurrency(payout.commission)}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600 text-right">
                      {formatCurrency(payout.providerEarning)}
                    </td>
                    {tab === "history" && (
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {formatDate(payout.payoutDate)}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {payout.paymentDetailsCompleted ? (
                        <div className="text-green-600 font-medium">✓ Complete</div>
                      ) : (
                        <div className="text-red-600 font-medium">✗ Incomplete</div>
                      )}
                      {payout.paymentDetails?.accountNumber && (
                        <p className="text-xs text-gray-500 mt-1">
                          {payout.paymentDetails.accountNumber.slice(-4).padStart(4, "*")} •{" "}
                          {payout.paymentDetails.ifscCode}
                        </p>
                      )}
                    </td>
                    {tab === "pending" && (
                      <td className="px-6 py-4 text-sm">
                        {payout.canPay ? (
                          <button
                            onClick={() => handleMarkAsPaid(payout.bookingId)}
                            disabled={markedPaidId === payout.bookingId}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {markedPaidId === payout.bookingId
                              ? "Processing..."
                              : "Mark Paid"}
                          </button>
                        ) : (
                          <div className="text-xs text-red-600 font-medium">
                            ⚠ Details incomplete
                          </div>
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
