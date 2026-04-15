import React, { useEffect, useState } from "react";
import api from "../api";
import Loader from "../components/Loader";

const ProviderRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [expandedId, setExpandedId] = useState(null);
  const [photoErrors, setPhotoErrors] = useState({});

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/admin/provider-requests");
      setRequests(res.data);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const approve = async (id) => {
    try {
      await api.post(`/admin/provider-requests/approve/${id}`);
      alert("Provider approved successfully.");
      fetchRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Approval failed");
    }
  };

  const reject = async (id) => {
    const reason = window.prompt("Enter reason for rejection:");
    if (!reason) return;

    try {
      await api.post(`/admin/provider-requests/reject/${id}`, { reason });
      alert("Provider rejected.");
      fetchRequests();
    } catch (err) {
      alert("Rejection failed");
    }
  };

  const toggleExpanded = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handlePhotoError = (id) => {
    setPhotoErrors(prev => ({ ...prev, [id]: true }));
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const visibleRequests = filter === "all"
    ? requests
    : requests.filter((r) => r.status === "pending");

  if (loading) {
    return <Loader text="Loading requests..." />;
  }

  return (
    <div className="provider-requests">
      <div className="page-header">
        <h2>Provider Verification Requests</h2>
        <p>Review and approve/reject new service provider registrations</p>
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

      {visibleRequests.length === 0 ? (
        <div className="empty-state">
          <p>No requests found.</p>
        </div>
      ) : (
        <div className="requests-container">
          {visibleRequests.map((req) => (
            <div key={req._id} className="request-card">
              <div className="request-header">
                <div className="provider-info">
                  {req.profilePhoto && !photoErrors[req._id] ? (
                    <img 
                      src={req.profilePhoto} 
                      alt={req.name} 
                      className="provider-photo"
                      onError={() => handlePhotoError(req._id)}
                    />
                  ) : (
                    <div className="provider-avatar">{req.name?.charAt(0) || "P"}</div>
                  )}
                  <div>
                    <h3>{req.name}</h3>
                    <p className="provider-email">{req.email}</p>
                  </div>
                </div>
                <span className="status-badge pending">{req.status || "pending"}</span>
              </div>

              <div className={`request-details ${expandedId === req._id ? "expanded" : ""}`}>
                {/* Basic Information Section */}
                <div className="details-section">
                  <h4 className="section-title">Contact Information</h4>
                  <div className="detail-row">
                    <span className="label">Email:</span>
                    <span className="value">{req.email || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Mobile:</span>
                    <span className="value">{req.mobile || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Address:</span>
                    <span className="value">{req.address || "-"}</span>
                  </div>
                </div>

                {/* Service Details Section */}
                <div className="details-section">
                  <h4 className="section-title">Service Details</h4>
                  <div className="detail-row">
                    <span className="label">Service Category:</span>
                    <span className="value">{req.serviceCategory || "-"}</span>
                  </div>
                  {req.otherService && (
                    <div className="detail-row">
                      <span className="label">Other Service:</span>
                      <span className="value">{req.otherService}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="label">Experience:</span>
                    <span className="value">{req.experience || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Qualification:</span>
                    <span className="value">{req.qualification || "-"}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Available Time:</span>
                    <span className="value">{req.availableTime || "-"}</span>
                  </div>
                </div>

                {/* Description Section */}
                <div className="details-section">
                  <h4 className="section-title">Description</h4>
                  <div className="description-box">
                    {req.description || "No description provided"}
                  </div>
                </div>

                {/* Certifications Section */}
                {(req.profilePhoto || req.skillCertificate) && (
                  <div className="details-section">
                    <h4 className="section-title">Files & Certifications</h4>
                    {req.profilePhoto && (
                      <div className="file-item">
                        <span className="file-label">Profile Photo:</span>
                        <a 
                          href={req.profilePhoto} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="file-link"
                          download={false}
                        >
                          View Photo
                        </a>
                      </div>
                    )}
                    {req.skillCertificate && (
                      <div className="file-item">
                        <span className="file-label">Skill Certificate:</span>
                        <a 
                          href={req.skillCertificate} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="file-link"
                          download={false}
                        >
                          View Certificate
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button
                className="expand-btn"
                onClick={() => toggleExpanded(req._id)}
              >
                {expandedId === req._id ? "Show Less" : "View Full Details"}
              </button>

              <div className="action-buttons">
                <button className="btn-approve" onClick={() => approve(req._id)}>
                  ✓ Approve
                </button>
                <button className="btn-reject" onClick={() => reject(req._id)}>
                  ✗ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProviderRequests;
