import React, { useEffect, useState } from "react";
import api from "../api";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [actionReason, setActionReason] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get("/admin/users");
      setUsers(res.data);
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (user) => {
    alert(
      `Name: ${user.name || "-"}\nEmail: ${user.email || "-"}\nPhone: ${user.mobile || "-"}\nAddress: ${user.address || "-"}\nStatus: ${user.status || "active"}\n${user.status === "banned" ? `Ban Reason: ${user.banReason || "-"}` : ""}`
    );
  };

  const openBanModal = (user) => {
    setSelectedUser(user);
    setActionReason("");
    setShowBanModal(true);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setActionReason("");
    setShowDeleteModal(true);
  };

  const handleBan = async () => {
    if (!actionReason.trim()) {
      alert("Please provide a reason for banning this user");
      return;
    }

    try {
      setProcessing(true);
      await api.post(`/admin/users/${selectedUser._id}/ban`, { reason: actionReason });
      setUsers((prev) =>
        prev.map((u) =>
          u._id === selectedUser._id
            ? { ...u, status: "banned", banReason: actionReason, bannedAt: new Date() }
            : u
        )
      );
      alert("User banned successfully and notification email sent");
      setShowBanModal(false);
      setSelectedUser(null);
      setActionReason("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to ban user");
    } finally {
      setProcessing(false);
    }
  };

  const handleUnban = async (user) => {
    if (!window.confirm(`Unban ${user.name}? They will be able to access the platform again.`)) {
      return;
    }

    try {
      await api.post(`/admin/users/${user._id}/unban`);
      setUsers((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? { ...u, status: "active", banReason: null, bannedAt: null }
            : u
        )
      );
      alert("User unbanned successfully and notification email sent");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to unban user");
    }
  };

  const handleDelete = async () => {
    if (!actionReason.trim()) {
      alert("Please provide a reason for deleting this user");
      return;
    }

    try {
      setProcessing(true);
      await api.delete(`/admin/users/${selectedUser._id}`, { data: { reason: actionReason } });
      setUsers((prev) => prev.filter((u) => u._id !== selectedUser._id));
      alert("User deleted permanently. Email has been blacklisted and cannot be used again.");
      setShowDeleteModal(false);
      setSelectedUser(null);
      setActionReason("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to delete user");
    } finally {
      setProcessing(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const q = searchTerm.toLowerCase();
    return (
      (user.name || "").toLowerCase().includes(q) ||
      (user.email || "").toLowerCase().includes(q) ||
      (user.mobile || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="users-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h2>Users Management</h2>
        <p>View and manage all registered customers</p>
      </div>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search users by name, email or mobile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Join Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="6" className="no-data">No users found</td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>{user.name || "-"}</td>
                  <td>{user.email || "-"}</td>
                  <td>{user.mobile || "-"}</td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <span className={`status-badge ${user.status === "banned" ? "banned" : "active"}`}>
                      {user.status === "banned" ? "Banned" : "Active"}
                    </span>
                  </td>
                  <td>
                    <div className="action-links">
                      <button className="action-link view" onClick={() => handleView(user)}>View</button>
                      {user.status === "banned" ? (
                        <button className="action-link success" onClick={() => handleUnban(user)}>Unban</button>
                      ) : (
                        <button className="action-link warning" onClick={() => openBanModal(user)}>Ban</button>
                      )}
                      <button className="action-link delete" onClick={() => openDeleteModal(user)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Ban Modal */}
      {showBanModal && selectedUser && (
        <div className="modal-overlay" onClick={() => !processing && setShowBanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Ban User: {selectedUser.name}</h3>
            <p style={{ marginBottom: "15px", color: "#666" }}>
              Provide a reason for banning this user. They will receive an email notification.
            </p>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter ban reason (e.g., Violation of terms, Fraudulent activity, etc.)"
              rows={4}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "14px",
                fontFamily: "inherit"
              }}
              disabled={processing}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowBanModal(false)}
                disabled={processing}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: processing ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBan}
                disabled={processing}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#f59e0b",
                  color: "#fff",
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: "600"
                }}
              >
                {processing ? "Banning..." : "Ban User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && selectedUser && (
        <div className="modal-overlay" onClick={() => !processing && setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#dc2626" }}>Delete User: {selectedUser.name}</h3>
            <div style={{ background: "#fee2e2", padding: "12px", borderRadius: "6px", marginBottom: "15px" }}>
              <strong style={{ color: "#991b1b" }}>⚠️ Warning:</strong>
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", color: "#991b1b" }}>
                <li>This action is permanent and cannot be undone</li>
                <li>The user's email will be blacklisted forever</li>
                <li>They won't be able to create a new account with this email</li>
              </ul>
            </div>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              placeholder="Enter deletion reason (required)"
              rows={4}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "6px",
                border: "1px solid #ddd",
                fontSize: "14px",
                fontFamily: "inherit"
              }}
              disabled={processing}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={processing}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  cursor: processing ? "not-allowed" : "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={processing}
                style={{
                  padding: "10px 20px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#dc2626",
                  color: "#fff",
                  cursor: processing ? "not-allowed" : "pointer",
                  fontWeight: "600"
                }}
              >
                {processing ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
