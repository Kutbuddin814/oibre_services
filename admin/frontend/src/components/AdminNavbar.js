import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import "../styles/AdminNavbar.css";

const AdminNavbar = ({ sidebarOpen, setSidebarOpen, admin, onLogout }) => {
  const initial = admin?.name?.charAt(0)?.toUpperCase() || "A";
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const mobileMenuRef = useRef(null);
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  });

  // Close mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
        setShowMobileMenu(false);
      }
    }
    if (showMobileMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMobileMenu]);

  const openPasswordModal = () => {
    setShowPasswordModal(true);
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setShowPassword({ current: false, next: false, confirm: false });
    setError("");
    setSuccess("");
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setSubmitting(false);
    setError("");
    setSuccess("");
    setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
  };

  const handleSubmitPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError("Please fill all fields.");
      return;
    }

    if (form.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.put("/admin/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setSuccess(res?.data?.message || "Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to change password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <nav className="admin-navbar">
        <div className="navbar-left">
          <button
            className="menu-btn"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            &#9776;
          </button>
          <h1 className="navbar-logo">Oibre Admin</h1>
        </div>
        <div className="navbar-right">
          <div 
            className="admin-profile" 
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            ref={mobileMenuRef}
          >
            <div className="profile-avatar">{initial}</div>
            <div className="profile-info">
              <p className="profile-name">{admin?.name || "Admin"}</p>
              <p className="profile-role">Administrator</p>
            </div>
            {showMobileMenu && (
              <div className="admin-profile-mobile-menu" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => { setShowMobileMenu(false); openPasswordModal(); }}>
                  Change Password
                </button>
                <button onClick={() => { setShowMobileMenu(false); onLogout(); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
          <button className="change-password-btn" onClick={openPasswordModal}>
            Change Password
          </button>
          <button className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      </nav>

      {showPasswordModal && (
        <div className="admin-password-overlay" onClick={closePasswordModal}>
          <div className="admin-password-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Password</h3>
            <p>Update your admin password.</p>
            <form onSubmit={handleSubmitPassword} className="admin-password-form">
              <label htmlFor="admin-current-password">Current Password</label>
              <div className="password-input-wrap">
                <input
                  id="admin-current-password"
                  type={showPassword.current ? "text" : "password"}
                  value={form.currentPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, current: !prev.current }))
                  }
                  aria-label={showPassword.current ? "Hide password" : "Show password"}
                >
                  &#128065;
                </button>
              </div>

              <label htmlFor="admin-new-password">New Password</label>
              <div className="password-input-wrap">
                <input
                  id="admin-new-password"
                  type={showPassword.next ? "text" : "password"}
                  value={form.newPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, next: !prev.next }))
                  }
                  aria-label={showPassword.next ? "Hide password" : "Show password"}
                >
                  &#128065;
                </button>
              </div>

              <label htmlFor="admin-confirm-password">Confirm New Password</label>
              <div className="password-input-wrap">
                <input
                  id="admin-confirm-password"
                  type={showPassword.confirm ? "text" : "password"}
                  value={form.confirmPassword}
                  onChange={(e) => setForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() =>
                    setShowPassword((prev) => ({ ...prev, confirm: !prev.confirm }))
                  }
                  aria-label={showPassword.confirm ? "Hide password" : "Show password"}
                >
                  &#128065;
                </button>
              </div>

              {error ? <div className="admin-password-error">{error}</div> : null}
              {success ? <div className="admin-password-success">{success}</div> : null}

              <div className="admin-password-actions">
                <button type="button" onClick={closePasswordModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting}>
                  {submitting ? "Updating..." : "Update"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AdminNavbar;
