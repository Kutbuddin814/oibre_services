import React, { useEffect, useMemo, useState } from "react";
import api from "../api";

const Providers = () => {
  const AUTO_REFRESH_MS = 15000;
  const [searchTerm, setSearchTerm] = useState("");
  const [filterService, setFilterService] = useState("all");
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockingId, setBlockingId] = useState(null);
  const [blockReason, setBlockReason] = useState("");
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);

  const closeBlockModal = () => {
    setShowBlockModal(false);
    setBlockingId(null);
    setBlockReason("");
  };

  const closeProfileModal = () => {
    setSelectedProvider(null);
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchProviders({ silent: true });
    }, AUTO_REFRESH_MS);

    const handleFocus = () => {
      fetchProviders({ silent: true });
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (!selectedProvider?._id) return;
    const latest = providers.find((p) => p._id === selectedProvider._id);
    if (latest) {
      setSelectedProvider(latest);
    }
  }, [providers, selectedProvider?._id]);

  const fetchProviders = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const res = await api.get("/admin/providers");
      setProviders(res.data);
    } catch (err) {
      console.error("Failed to fetch providers", err);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const services = useMemo(() => {
    const values = providers
      .map((p) => p.serviceCategory)
      .filter(Boolean);
    return ["all", ...Array.from(new Set(values))];
  }, [providers]);

  const filteredProviders = providers.filter((provider) =>
    (filterService === "all" || provider.serviceCategory === filterService) &&
    (
      (provider.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (provider.email || "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleView = (provider) => {
    setSelectedProvider(provider);
  };

  const resetProviderPassword = async (provider) => {
    const confirmed = window.confirm(
      `Reset password for ${provider.name}? A new temporary password will be sent to ${provider.email}.`
    );
    if (!confirmed) return;

    try {
      await api.post(`/admin/providers/${provider._id}/reset-password`);
      alert("New temporary password sent to provider email.");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reset provider password");
    }
  };

  const toggleStatus = async (provider) => {
    if (provider.status === "approved") {
      // Show block modal if approving to blocked
      setBlockingId(provider._id);
      setBlockReason("");
      setShowBlockModal(true);
    } else {
      // Unblock without asking for reason
      try {
        await api.patch(`/admin/providers/${provider._id}/status`, { status: "approved" });
        setProviders((prev) =>
          prev.map((p) => (p._id === provider._id ? { ...p, status: "approved" } : p))
        );
        alert("Provider unblocked successfully! Email notification sent.");
      } catch (err) {
        alert(err.response?.data?.message || "Failed to unblock provider");
      }
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockReason.trim()) {
      alert("Please enter a reason for blocking this provider.");
      return;
    }

    try {
      await api.patch(`/admin/providers/${blockingId}/status`, {
        status: "blocked",
        blockReason: blockReason.trim()
      });

      setProviders((prev) =>
        prev.map((p) => (p._id === blockingId ? { ...p, status: "blocked" } : p))
      );

      alert("Provider blocked successfully! Email notification sent.");
      closeBlockModal();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to block provider");
    }
  };

  if (loading) {
    return (
      <div className="providers-page">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="providers-page">
      <div className="page-header">
        <h2>Service Providers</h2>
        <p>Manage all active service providers on your platform</p>
      </div>

      <div className="filters-section">
        <input
          type="text"
          placeholder="Search providers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filterService}
          onChange={(e) => setFilterService(e.target.value)}
          className="filter-select"
        >
          {services.map((service) => (
            <option key={service} value={service}>
              {service === "all" ? "All Services" : service}
            </option>
          ))}
        </select>
      </div>

      {filteredProviders.length === 0 ? (
        <div className="empty-state">
          <p>No providers found</p>
        </div>
      ) : (
        <div className="providers-grid">
          {filteredProviders.map((provider) => (
            <div key={provider._id} className="provider-card">
              <div className="provider-header">
                <div className="provider-avatar">{provider.name?.charAt(0) || "P"}</div>
                <span className={`status-badge ${provider.status === "blocked" ? "inactive" : "active"}`}>
                  {provider.status === "blocked" ? "Blocked" : "Active"}
                </span>
              </div>

              <h3>{provider.name}</h3>
              <p className="provider-email">{provider.email}</p>
              <p className="provider-service">{provider.serviceCategory || "N/A"}</p>

              <div className="rating-section">
                <div className="rating">
                  <span className="stars">Rating {Number(provider.averageRating || 0).toFixed(1)}</span>
                  <span className="reviews">({provider.reviewCount || 0} reviews)</span>
                </div>
              </div>

              <div className="provider-footer">
                <small className="join-date">
                  Joined {provider.createdAt ? new Date(provider.createdAt).toLocaleDateString() : "-"}
                </small>
              </div>

              <div className="provider-actions">
                <button className="btn-view" onClick={() => handleView(provider)}>View Profile</button>
                <button className="btn-edit" onClick={() => toggleStatus(provider)}>
                  {provider.status === "blocked" ? "Unblock" : "Block"}
                </button>
                <button className="btn-reset" onClick={() => resetProviderPassword(provider)}>
                  Reset Password
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedProvider && (
        <div className="modal-overlay profile-modal-overlay" onClick={closeProfileModal}>
          <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div className="provider-avatar profile-avatar">{selectedProvider.name?.charAt(0) || "P"}</div>
              <div>
                <h3>{selectedProvider.name || "N/A"}</h3>
                <p className="profile-role">{selectedProvider.serviceCategory || "Service Provider"}</p>
              </div>
              <span className={`status-badge ${selectedProvider.status === "blocked" ? "inactive" : "active"}`}>
                {selectedProvider.status === "blocked" ? "Blocked" : "Active"}
              </span>
            </div>

            <div className="profile-rating-bar">
              <strong>{Number(selectedProvider.averageRating || 0).toFixed(1)}</strong>
              <span>Average Rating</span>
              <small>{selectedProvider.reviewCount || 0} reviews</small>
            </div>

            <div className="profile-grid">
              <div className="profile-item">
                <label>Email</label>
                <p>{selectedProvider.email || "N/A"}</p>
              </div>
              <div className="profile-item">
                <label>Phone</label>
                <p>{selectedProvider.mobile || "N/A"}</p>
              </div>
              <div className="profile-item">
                <label>Qualification</label>
                <p>{selectedProvider.qualification || "N/A"}</p>
              </div>
              <div className="profile-item">
                <label>Experience</label>
                <p>{selectedProvider.experience || "N/A"}</p>
              </div>
              <div className="profile-item">
                <label>Available Time</label>
                <p>{selectedProvider.availableTime || "N/A"}</p>
              </div>
              <div className="profile-item">
                <label>Joined</label>
                <p>{selectedProvider.createdAt ? new Date(selectedProvider.createdAt).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>

            <div className="profile-full-row">
              <label>Address</label>
              <p>{selectedProvider.address || "N/A"}</p>
            </div>

            <div className="profile-full-row">
              <label>About</label>
              <p>{selectedProvider.description || "No description provided."}</p>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={closeProfileModal}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Block Provider Modal */}
      {showBlockModal && (
        <div className="modal-overlay" onClick={closeBlockModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Block Service Provider</h3>
            <p>Please provide a reason for blocking this provider. This will be sent via email.</p>

            <textarea
              placeholder="Enter reason for blocking..."
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              className="block-reason-input"
              rows="5"
            />

            <div className="modal-actions">
              <button
                className="btn-cancel"
                onClick={closeBlockModal}
              >
                Cancel
              </button>
              <button
                className="btn-confirm-block"
                onClick={handleConfirmBlock}
              >
                Block Provider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Providers;
