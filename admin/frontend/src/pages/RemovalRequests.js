import React, { useEffect, useState } from "react";
import api from "../api";

const RemovalRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");

  const fetchRequests = async () => {
    try {
      const res = await api.get("/admin/removal-requests");
      setRequests(res.data || []);
    } catch (err) {
      console.error("Failed to fetch removal requests", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const approve = async (id) => {
    if (!window.confirm("Remove provider and approve this request?")) return;

    try {
      await api.patch(`/admin/removal-requests/${id}/approve`, {});
      alert("Provider removed successfully.");
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve request.");
    }
  };

  const reject = async (id) => {
    const adminNote = window.prompt("Optional note for rejection:");
    try {
      await api.patch(`/admin/removal-requests/${id}/reject`, { adminNote: adminNote || "" });
      alert("Removal request rejected.");
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject request.");
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const visible = filter === "all"
    ? requests
    : requests.filter((r) => r.status === "pending");

  if (loading) {
    return (
      <div className="removal-requests">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="removal-requests">
      <div className="page-header">
        <h2>Removal Requests</h2>
        <p>Requests from providers to remove their accounts</p>
      </div>

      <div className="filter-bar">
        <button
          className={`filter-btn ${filter === "pending" ? "active" : ""}`}
          onClick={() => setFilter("pending")}
        >
          Pending ({pendingCount})
        </button>
        <button
          className={`filter-btn ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All ({requests.length})
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="empty-state">
          <p>No removal requests found.</p>
        </div>
      ) : (
        <div className="removal-requests-grid">
          {visible.map((req) => (
            <div key={req._id} className="removal-card">
              <div className="removal-header">
                <div>
                  <h3>{req.name || "Provider"}</h3>
                  <p className="removal-email">{req.email || "-"}</p>
                </div>
                <span className={`status-badge ${req.status}`}>
                  {req.status}
                </span>
              </div>

              <div className="removal-body">
                <p className="removal-reason">
                  {req.reason || "No reason provided."}
                </p>
                <p className="removal-date">
                  Requested: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "-"}
                </p>
              </div>

              {req.status === "pending" && (
                <div className="removal-actions">
                  <button className="btn-approve" onClick={() => approve(req._id)}>
                    Approve & Remove
                  </button>
                  <button className="btn-reject" onClick={() => reject(req._id)}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RemovalRequests;
