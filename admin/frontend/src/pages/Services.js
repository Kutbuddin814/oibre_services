import React, { useState, useEffect } from "react";
import api from "../api";

const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [addingDefaults, setAddingDefaults] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    icon: "\uD83D\uDD27"
  });
  const [iconFile, setIconFile] = useState(null);
  const [iconPreview, setIconPreview] = useState("");
  const [error, setError] = useState("");

  const commonIcons = ["\uD83D\uDD27", "\uD83E\uDDF9", "\uD83D\uDCA1", "\uD83D\uDEB0", "\uD83C\uDFA8", "\uD83D\uDD28", "\uD83E\uDDF2", "\u26A1", "\uD83D\uDEE0\uFE0F", "\uD83E\uDEF1", "\uD83E\uDDF0"];

  const defaultServices = [
  { name: "Electrician", icon: "\u26A1", description: "Wiring, fixtures, and electrical repairs" },
  { name: "Plumber", icon: "\uD83D\uDD27", description: "Leak fixes, fittings, and pipe services" },
  { name: "Cleaning", icon: "\uD83E\uDDF9", description: "Home and office cleaning services" },
  { name: "Taxi", icon: "\uD83D\uDE95", description: "Local pickup, drop, and city rides" },
  { name: "Carpenter", icon: "\uD83E\uDE9A", description: "Furniture repair and woodwork" },
  { name: "Mechanic", icon: "\uD83D\uDD29", description: "Vehicle repair and servicing" },
  { name: "AC Service", icon: "\uD83D\uDCA8", description: "AC installation and maintenance" },
  { name: "Appliance Repair", icon: "\uD83D\uDEE0\uFE0F", description: "Repair for home appliances" },
  { name: "Painter", icon: "\uD83C\uDFA8", description: "Interior and exterior painting" },
  { name: "Pest Control", icon: "\uD83D\uDC1C", description: "Pest removal and prevention" },
  { name: "Laundry", icon: "\uD83E\uDDFA", description: "Wash, iron, and dry-clean services" },
  { name: "Salon at Home", icon: "\uD83D\uDC87", description: "Salon and grooming at home" },
  { name: "Tutor", icon: "\uD83D\uDCDA", description: "Home tutoring and coaching" },
  { name: "Babysitter", icon: "\uD83D\uDC76", description: "Child care and babysitting" },
  { name: "Mover & Packer", icon: "\uD83D\uDCE6", description: "Packing and moving services" }
];

  const serviceIconFallbacks = defaultServices.reduce((acc, item) => {
    acc[item.name] = item.icon;
    return acc;
  }, {});

  const getServiceIcon = (service) => {
    const raw = service?.icon || "";
    if (!raw || /Ã|ðŸ|â|Â/.test(raw)) {
      return serviceIconFallbacks[service?.name] || "\uD83D\uDD27";
    }
    return raw;
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/services");
      setServices(res.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch services");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = () => {
    setEditingId(null);
    setFormData({ name: "", description: "", icon: "\uD83D\uDD27" });
    setIconFile(null);
    setIconPreview("");
    setShowModal(true);
  };

  const handleAddCommonServices = async () => {
    setError("");
    const normalize = (name) => name.trim().toLowerCase();
    const existingNames = new Set(services.map((s) => normalize(s.name)));
    const toAdd = defaultServices.filter(
      (service) => !existingNames.has(normalize(service.name))
    );

    if (toAdd.length === 0) {
      setError("All common services are already added.");
      return;
    }

    try {
      setAddingDefaults(true);
      for (const service of toAdd) {
        try {
          const payload = new FormData();
          payload.append("name", service.name);
          payload.append("description", service.description || "");
          payload.append("icon", service.icon || "");
          await api.post("/admin/services", payload, {
            headers: { "Content-Type": "multipart/form-data" }
          });
        } catch (err) {
          if (err.response?.status !== 409) {
            throw err;
          }
        }
      }
      await fetchServices();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add common services");
    } finally {
      setAddingDefaults(false);
    }
  };

  const handleEditService = (service) => {
    setEditingId(service._id);
    setFormData({
      name: service.name,
      description: service.description,
      icon: getServiceIcon(service)
    });
    setIconFile(null);
    setIconPreview(
      service.iconImage ? `http://localhost:5001/uploads/${service.iconImage}` : ""
    );
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Service name is required");
      return;
    }

    try {
      const payload = new FormData();
      payload.append("name", formData.name);
      payload.append("description", formData.description || "");
      payload.append("icon", formData.icon || "");
      if (iconFile) {
        payload.append("iconImage", iconFile);
      }

      if (editingId) {
        await api.patch(`/admin/services/${editingId}`, payload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        await api.post("/admin/services", payload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      }

      await fetchServices();

      setShowModal(false);
      setFormData({ name: "", description: "", icon: "\uD83D\uDD27" });
      setIconFile(null);
      setIconPreview("");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save service");
    }
  };

  const handleDeleteService = async (id) => {
    if (window.confirm("Are you sure you want to delete this service?")) {
      try {
        await api.delete(`/admin/services/${id}`);
        setServices((prev) => prev.filter((s) => s._id !== id));
      } catch (err) {
        alert("Failed to delete service");
      }
    }
  };

  if (loading) {
    return <div className="services-page"><p>Loading...</p></div>;
  }

  return (
    <div className="services-page">
      <div className="page-header">
        <h2>Manage Services</h2>
        <p>Add, edit, or remove service categories available to providers</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="services-actions">
        <button className="btn-add-service" onClick={handleAddService}>
          + Add New Service
        </button>
        <button
          className="btn-add-common"
          onClick={handleAddCommonServices}
          disabled={addingDefaults || loading}
        >
          {addingDefaults ? "Adding Common Services..." : "Add Common Services"}
        </button>
      </div>

      {services.length === 0 ? (
        <div className="empty-state">
          <p>No services found. Add one to get started!</p>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((service) => (
            <div key={service._id} className="service-card">
              <div className="service-icon">
                {service.iconImage ? (
                  <img
                    src={`http://localhost:5001/uploads/${service.iconImage}`}
                    alt={service.name}
                    className="service-icon-image"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  getServiceIcon(service)
                )}
              </div>
              <h3>{service.name}</h3>
              {service.description && <p className="service-description">{service.description}</p>}
              <span className={`service-status ${service.status}`}>{service.status}</span>
              <div className="service-actions">
                <button
                  className="btn-edit-service"
                  onClick={() => handleEditService(service)}
                >
                  Edit
                </button>
                <button
                  className="btn-delete-service"
                  onClick={() => handleDeleteService(service._id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{editingId ? "Edit Service" : "Add New Service"}</h3>

            <form onSubmit={handleSubmit}>
              {error && <div className="form-error">{error}</div>}

              <div className="form-group">
                <label>Service Name *</label>
                <input
                  type="text"
                  placeholder="e.g., Plumbing, Electrician"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  placeholder="Brief description of the service"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Icon</label>
                <div className="icon-selector">
                  {commonIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      className={`icon-btn ${formData.icon === icon ? "selected" : ""}`}
                      onClick={() => setFormData({ ...formData, icon })}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Or enter custom emoji"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="icon-input"
                  maxLength="2"
                />
              </div>

              <div className="form-group">
                <label>Custom Icon Image (optional)</label>
                {iconPreview && (
                  <div className="icon-preview">
                    <img src={iconPreview} alt="icon preview" />
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setIconFile(file);
                    setIconPreview(file ? URL.createObjectURL(file) : iconPreview);
                  }}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-save">
                  {editingId ? "Update Service" : "Add Service"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
