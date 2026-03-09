import React, { useEffect, useState } from "react";
import api from "../api";

const Dashboard = ({ setCurrentPage }) => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProviders: 0,
    totalRequests: 0,
    pendingRequests: 0,
    newContactMessages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get("/admin/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadJson = (filename, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    try {
      const res = await api.get("/admin/reports/summary");
      downloadJson("oibre-admin-summary-report.json", res.data);
      alert("Summary report generated and downloaded.");
    } catch (err) {
      alert("Failed to generate report");
    }
  };

  const handleExportData = async () => {
    try {
      const res = await api.get("/admin/export/all");
      downloadJson("oibre-admin-export.json", res.data);
      alert("Data export downloaded.");
    } catch (err) {
      alert("Failed to export data");
    }
  };

  const handleUpdateServicePrices = () => {
    setCurrentPage("services");
  };

  if (loading) {
    return (
      <div className="dashboard">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard Overview</h2>
        <p>Live admin metrics from MongoDB</p>
      </div>

      <div className="stats-grid">
        <button
          type="button"
          className="stat-card"
          onClick={() => setCurrentPage("users")}
          title="Open Users"
        >
          <div className="stat-icon" style={{ background: "#E3F2FD" }}>Users</div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-number">{stats.totalUsers}</p>
          </div>
        </button>

        <button
          type="button"
          className="stat-card"
          onClick={() => setCurrentPage("providers")}
          title="Open Service Providers"
        >
          <div className="stat-icon" style={{ background: "#F3E5F5" }}>SP</div>
          <div className="stat-content">
            <h3>Service Providers</h3>
            <p className="stat-number">{stats.totalProviders}</p>
          </div>
        </button>

        <button
          type="button"
          className="stat-card"
          onClick={() => setCurrentPage("payouts")}
          title="Total service booking requests from customers"
        >
          <div className="stat-icon" style={{ background: "#FFF3E0" }}>Req</div>
          <div className="stat-content">
            <h3>Service Bookings</h3>
            <p className="stat-number">{stats.totalRequests}</p>
          </div>
        </button>

        <button
          type="button"
          className="stat-card"
          onClick={() => setCurrentPage("provider-requests")}
          title="Open Provider Registration Requests"
        >
          <div className="stat-icon" style={{ background: "#FCE4EC" }}>Pend</div>
          <div className="stat-content">
            <h3>Provider Registrations</h3>
            <p className="stat-number">{stats.pendingRequests} pending</p>
          </div>
        </button>

        <button
          type="button"
          className="stat-card"
          onClick={() => setCurrentPage("contact-messages")}
          title="Open Contact Messages"
        >
          <div className="stat-icon" style={{ background: "#E0F2FE" }}>Msg</div>
          <div className="stat-content">
            <h3>New Contact Messages</h3>
            <p className="stat-number">{stats.newContactMessages}</p>
          </div>
        </button>
      </div>

      <div className="dashboard-sections">
        <div className="section">
          <h3>Recent Activity</h3>
          <div className="activity-list">
            <button
              type="button"
              className="activity-item-btn activity-item"
              onClick={() => setCurrentPage("provider-requests")}
            >
              <span className="activity-icon">1</span>
              <div className="activity-details">
                <p><b>Pending Provider Registrations</b></p>
                <p className="activity-time">{stats.pendingRequests} awaiting review</p>
              </div>
            </button>
            <button
              type="button"
              className="activity-item-btn activity-item"
              onClick={() => setCurrentPage("users")}
            >
              <span className="activity-icon">2</span>
              <div className="activity-details">
                <p><b>Total Customer Accounts</b></p>
                <p className="activity-time">{stats.totalUsers} users</p>
              </div>
            </button>
            <button
              type="button"
              className="activity-item-btn activity-item"
              onClick={() => setCurrentPage("providers")}
            >
              <span className="activity-icon">3</span>
              <div className="activity-details">
                <p><b>Approved Service Providers</b></p>
                <p className="activity-time">{stats.totalProviders} providers</p>
              </div>
            </button>
            <button
              type="button"
              className="activity-item-btn activity-item"
              onClick={() => setCurrentPage("payouts")}
            >
              <span className="activity-icon">4</span>
              <div className="activity-details">
                <p><b>Service Booking Requests</b></p>
                <p className="activity-time">{stats.totalRequests} bookings</p>
              </div>
            </button>
            <button
              type="button"
              className="activity-item-btn activity-item"
              onClick={() => setCurrentPage("contact-messages")}
            >
              <span className="activity-icon">5</span>
              <div className="activity-details">
                <p><b>New Contact Form Messages</b></p>
                <p className="activity-time">{stats.newContactMessages} new messages</p>
              </div>
            </button>
          </div>
        </div>

        <div className="section">
          <h3>Quick Actions</h3>
          <div className="action-buttons">
            <button className="action-btn primary" onClick={handleGenerateReport}>Generate Report</button>
            <button className="action-btn secondary" onClick={handleExportData}>Export Data</button>
            <button className="action-btn secondary" onClick={handleUpdateServicePrices} style={{ background: "#059669", color: "#fff" }}>
              Update Service Prices
            </button>
            <button className="action-btn secondary" onClick={() => setCurrentPage("provider-requests")}>View Provider Logs</button>
            <button className="action-btn secondary" onClick={() => setCurrentPage("services")}>Manage Services</button>
            <button className="action-btn secondary" onClick={() => setCurrentPage("contact-messages")}>
              Contact Messages ({stats.newContactMessages})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
