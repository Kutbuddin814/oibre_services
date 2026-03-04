import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import "../styles/CustomerProfile.css";

export default function CustomerProfile() {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    mobile: "",
    address: ""
  });

  // Email change states
  const [showEmailChangeModal, setShowEmailChangeModal] = useState(false);
  const [emailChangeStep, setEmailChangeStep] = useState("email"); // "email" or "otp"
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      navigate("/auth");
      return;
    }

    api
      .get("/customers/me", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      .then((res) => setCustomer(res.data))
      .catch(() => {
        localStorage.removeItem("customerToken");
        navigate("/auth");
      });
  }, [navigate]);

  if (!customer) return null;

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    navigate("/");
  };

  const openEditModal = () => {
    setEditForm({
      name: customer.name || "",
      email: customer.email || "",
      mobile: customer.mobile || "",
      address: customer.address || ""
    });
    setEditError("");
    setShowEditModal(true);
  };

  const startEmailChange = () => {
    setNewEmailInput("");
    setEmailOtp("");
    setEmailChangeStep("email");
    setEmailError("");
    setEmailLoading(false);
    setShowEmailChangeModal(true);
  };

  const sendEmailOtp = async () => {
    const cleanEmail = String(newEmailInput || "").trim().toLowerCase();
    
    if (!cleanEmail) {
      setEmailError("Please enter a new email");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (cleanEmail === customer.email) {
      setEmailError("New email must be different from current email");
      return;
    }

    setEmailError("");
    setEmailLoading(true);

    try {
      const token = localStorage.getItem("customerToken");
      await api.post(
        "/customers/change-email/send-otp",
        { newEmail: cleanEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setEmailChangeStep("otp");
    } catch (err) {
      setEmailError(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setEmailLoading(false);
    }
  };

  const verifyEmailOtp = async () => {
    const cleanOtp = String(emailOtp || "").trim();
    
    if (!cleanOtp) {
      setEmailError("Please enter OTP");
      return;
    }

    setEmailError("");
    setEmailLoading(true);

    try {
      const token = localStorage.getItem("customerToken");
      const res = await api.post(
        "/customers/change-email/verify-otp",
        { newEmail: newEmailInput.trim().toLowerCase(), otp: cleanOtp },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCustomer(res.data.customer);
      localStorage.setItem("customerData", JSON.stringify(res.data.customer));
      setShowEmailChangeModal(false);
      alert("✅ Email changed successfully!");
    } catch (err) {
      setEmailError(err.response?.data?.message || "Failed to verify OTP");
    } finally {
      setEmailLoading(false);
    }
  };

  const saveProfile = async () => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      navigate("/auth");
      return;
    }

    const payload = {
      name: String(editForm.name || "").trim(),
      email: String(editForm.email || "").trim().toLowerCase(),
      mobile: String(editForm.mobile || "").trim(),
      address: String(editForm.address || "").trim()
    };

    if (!payload.name || !payload.mobile || !payload.address) {
      setEditError("Name, mobile and address are required.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(payload.mobile)) {
      setEditError("Enter a valid 10-digit mobile number.");
      return;
    }

    try {
      setSaving(true);
      setEditError("");
      const res = await api.put("/customers/profile", payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const updated = res.data?.customer || null;
      if (updated) {
        setCustomer(updated);
        localStorage.setItem("customerData", JSON.stringify(updated));
      }
      setShowEditModal(false);
    } catch (err) {
      setEditError(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-container">
      <button
        onClick={() => navigate(-1)}
        className="back-button"
        title="Go back"
      >
        Back
      </button>

      <div className="profile-card">
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar">
            {customer.name?.[0]?.toUpperCase() || "U"}
          </div>
        </div>

        <h2 className="profile-name">{customer.name}</h2>

        <div className="profile-info">
          <div className="profile-item">
            <span className="profile-item-label">Mobile:</span>
            <span className="profile-item-value">{customer.mobile}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item-label">Email:</span>
            <span className="profile-item-value">{customer.email || "Not provided"}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item-label">Address:</span>
            <span className="profile-item-value">{customer.address}</span>
          </div>
          <div className="profile-item">
            <span className="profile-item-label">Member Since:</span>
            <span className="profile-item-value">
              {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "-"}
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <button className="profile-btn edit-btn" onClick={openEditModal}>
            Edit Profile
          </button>
          <button className="profile-btn edit-btn" onClick={startEmailChange}>
            Change Email
          </button>
          <button onClick={handleLogout} className="profile-btn logout-btn">
            Logout
          </button>
        </div>
      </div>

      {showEditModal && (
        <div className="profile-modal-overlay" onClick={() => !saving && setShowEditModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <p>Update your account details.</p>

            <div className="profile-modal-field">
              <label>Full Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                disabled={saving}
              />
            </div>

            <div className="profile-modal-field">
              <label>Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                disabled={saving}
              />
              <small style={{ color: "#6b7280", marginTop: "4px", display: "block" }}>
                Use "Change Email" button to change email with verification
              </small>
            </div>

            <div className="profile-modal-field">
              <label>Mobile</label>
              <input
                type="text"
                value={editForm.mobile}
                maxLength={10}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    mobile: e.target.value.replace(/[^0-9]/g, "")
                  }))
                }
                disabled={saving}
              />
            </div>

            <div className="profile-modal-field">
              <label>Address</label>
              <textarea
                rows={3}
                value={editForm.address}
                onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                disabled={saving}
              />
            </div>

            {editError ? <div className="profile-modal-error">{editError}</div> : null}

            <div className="profile-modal-actions">
              <button type="button" onClick={() => setShowEditModal(false)} disabled={saving}>
                Cancel
              </button>
              <button type="button" onClick={saveProfile} disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEmailChangeModal && (
        <div className="profile-modal-overlay" onClick={() => !emailLoading && setShowEmailChangeModal(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Change Email</h3>
            <p>Verify your new email address with OTP</p>

            {emailChangeStep === "email" ? (
              <>
                <div className="profile-modal-field">
                  <label>New Email Address</label>
                  <input
                    type="email"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    placeholder="Enter new email"
                    disabled={emailLoading}
                  />
                </div>
                {emailError ? <div className="profile-modal-error">{emailError}</div> : null}
                <div className="profile-modal-actions">
                  <button onClick={() => setShowEmailChangeModal(false)} disabled={emailLoading}>
                    Cancel
                  </button>
                  <button onClick={sendEmailOtp} disabled={emailLoading}>
                    {emailLoading ? "Sending OTP..." : "Send OTP"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="profile-modal-field">
                  <label>Verification Code</label>
                  <input
                    type="text"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
                    placeholder="6-digit OTP"
                    maxLength={6}
                    disabled={emailLoading}
                  />
                  <small style={{ color: "#6b7280", marginTop: "4px", display: "block" }}>
                    Sent to {newEmailInput}
                  </small>
                </div>
                {emailError ? <div className="profile-modal-error">{emailError}</div> : null}
                <div className="profile-modal-actions">
                  <button onClick={() => setEmailChangeStep("email")} disabled={emailLoading}>
                    Back
                  </button>
                  <button onClick={verifyEmailOtp} disabled={emailLoading}>
                    {emailLoading ? "Verifying..." : "Verify & Change"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
