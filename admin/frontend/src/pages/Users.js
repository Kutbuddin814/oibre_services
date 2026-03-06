import React, { useEffect, useState } from "react";
import api from "../api";

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
      `Name: ${user.name || "-"}\nEmail: ${user.email || "-"}\nPhone: ${user.mobile || "-"}\nAddress: ${user.address || "-"}`
    );
  };

  const handleDelete = async (id) => {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;

    try {
      await api.delete(`/admin/users/${id}`);
      setUsers((prev) => prev.filter((u) => u._id !== id));
      alert("User deleted.");
    } catch (err) {
      alert("Failed to delete user");
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
                    <span className="status-badge active">Active</span>
                  </td>
                  <td>
                    <div className="action-links">
                      <button className="action-link view" onClick={() => handleView(user)}>View</button>
                      <button className="action-link edit" onClick={() => handleView(user)}>Edit</button>
                      <button className="action-link delete" onClick={() => handleDelete(user._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
