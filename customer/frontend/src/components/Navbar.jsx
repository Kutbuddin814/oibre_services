import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import MapPicker from "./MapPicker";

export default function Navbar() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [location, setLocation] = useState({ label: "Select location", lat: null, lng: null });
  const [detectedLabel, setDetectedLabel] = useState("");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [userLocationSet, setUserLocationSet] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef(null);
  const profileRef = useRef(null);
  const notificationRef = useRef(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState("");
  const [changePasswordSuccess, setChangePasswordSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    next: false,
    confirm: false
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const persistLocationToServer = async (locationData) => {
    const token = localStorage.getItem("customerToken");
    if (!token) return;
    if (!Number.isFinite(Number(locationData?.lat)) || !Number.isFinite(Number(locationData?.lng))) return;

    try {
      const payload = {
        lat: locationData.lat,
        lng: locationData.lng,
        address: locationData.address || locationData.label || "",
        locality: locationData.locality || locationData.label || "Unknown"
      };

      const res = await axios.put(
        "http://localhost:5000/api/customers/location",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res?.data?.customer) {
        localStorage.setItem("customerData", JSON.stringify(res.data.customer));
      }
    } catch (err) {
      console.error("Failed to save location in DB", err);
    }
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem("customerToken");
    if (!token) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      const res = await axios.get("http://localhost:5000/api/notifications", {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(res.data || []);
      setUnreadCount(res.data?.filter((n) => !n.read).length || 0);
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  // Check login status and fetch customer info
  useEffect(() => {
    // Use already selected location first, if present.
    try {
      const stored = localStorage.getItem("userLocation");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.lat && parsed?.lng) {
          setLocation({
            label: parsed.label || parsed.locality || parsed.address || "Selected location",
            lat: parsed.lat,
            lng: parsed.lng
          });
          setUserLocationSet(true);
        }
      }
    } catch (err) {
      console.warn("Failed to read stored location", err);
    }

    const loadCustomerData = () => {
      const token = localStorage.getItem("customerToken");
      const cachedCustomer = localStorage.getItem("customerData");

      if (token) {
        // Try to use cached data first
        if (cachedCustomer) {
          try {
            setCustomer(JSON.parse(cachedCustomer));
            setIsLoggedIn(true);
          } catch (e) {
            console.error("Failed to parse cached customer data", e);
          }
        }

        // Then fetch fresh data from API
        axios
          .get("http://localhost:5000/api/customers/me", {
            headers: { Authorization: `Bearer ${token}` }
          })
          .then((res) => {
            setCustomer(res.data);
            setIsLoggedIn(true);
            localStorage.setItem("customerData", JSON.stringify(res.data));

            const coords = res.data?.location?.coordinates || [];
            if (coords.length === 2) {
              const dbLoc = {
                lat: coords[1],
                lng: coords[0],
                address: res.data.address,
                locality: res.data.locality,
                label: res.data.locality || res.data.address || "Registered location",
                type: "registered"
              };

              localStorage.setItem("userLocation", JSON.stringify(dbLoc));
              setLocation({
                label: dbLoc.label,
                lat: dbLoc.lat,
                lng: dbLoc.lng
              });
              setUserLocationSet(true);
              window.dispatchEvent(new Event("userLocationChanged"));
            }
          })
          .catch((err) => {
            console.error("Failed to fetch customer data", err);
            localStorage.removeItem("customerToken");
            setIsLoggedIn(false);
            setCustomer(null);
          });
      } else {
        setIsLoggedIn(false);
        setCustomer(null);
      }
    };

    loadCustomerData();

    // Listen for localStorage changes (e.g., from login on another tab or same tab redirect)
    const handleStorageChange = (e) => {
      if (e.key === "customerToken" || e.key === "customerData") {
        loadCustomerData();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // On mount ask for location permission and try to get an accurate location
  useEffect(() => {
    if (userLocationSet) return; // Skip if user already set location
    if (localStorage.getItem("userLocation")) return;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          // Use Nominatim for readable label
          let label = "Pinned location";
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`);
            if (res.ok) {
              const data = await res.json();
              if (data && data.address) {
                const a = data.address;
                const prefer = ["hamlet", "village", "suburb", "neighbourhood", "town", "city_district", "city", "county", "state"];
                for (const key of prefer) {
                  if (a[key]) {
                    const extra = a.county || a.state || a.country;
                    label = extra ? `${a[key]}, ${extra}` : a[key];
                    break;
                  }
                }
              }
              if (!label && data.display_name) label = data.display_name;
            }
          } catch {}
          setLocation({ label, lat: latitude, lng: longitude });
          setDetectedLabel(label);
          setIsConfirmed(false);
        },
        (err) => {
          console.warn("Geolocation permission denied or unavailable", err);
          setLocation((s) => ({ ...s, label: "Select location" }));
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      setLocation((s) => ({ ...s, label: "Geolocation not supported" }));
    }
  }, [userLocationSet]);

  // Fetch notifications
  useEffect(() => {
    if (!isLoggedIn) return;
    fetchNotifications();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    if (notificationsOpen) {
      fetchNotifications();
    }
  }, [notificationsOpen, isLoggedIn]);

  useEffect(() => {
    const refresh = () => {
      if (isLoggedIn) fetchNotifications();
    };
    window.addEventListener("customerNotificationsRefresh", refresh);
    return () => window.removeEventListener("customerNotificationsRefresh", refresh);
  }, [isLoggedIn]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("customerToken");
    localStorage.removeItem("customerData");
    localStorage.removeItem("userLocation");
    setIsLoggedIn(false);
    setCustomer(null);
    setProfileOpen(false);
    setNotificationsOpen(false);
    navigate("/");
    window.location.reload();
  };

  const markNotificationRead = async (notificationId) => {
    const token = localStorage.getItem("customerToken");
    if (!token || !notificationId) return;

    try {
      await axios.put(
        `http://localhost:5000/api/notifications/read/${notificationId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }
  };

  const resetChangePasswordForm = () => {
    setPasswordForm({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setChangePasswordError("");
    setChangePasswordSuccess("");
    setChangePasswordLoading(false);
    setShowPassword({ current: false, next: false, confirm: false });
  };

  const handleOpenChangePassword = () => {
    resetChangePasswordForm();
    setShowChangePasswordModal(true);
    setProfileOpen(false);
  };

  const handleCloseChangePassword = () => {
    setShowChangePasswordModal(false);
    resetChangePasswordForm();
  };

  const handlePasswordChangeSubmit = async (e) => {
    e.preventDefault();
    setChangePasswordError("");
    setChangePasswordSuccess("");

    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setChangePasswordError("Please fill all fields.");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setChangePasswordError("New password must be at least 6 characters.");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setChangePasswordError("New password and confirm password do not match.");
      return;
    }

    const token = localStorage.getItem("customerToken");
    if (!token) {
      setChangePasswordError("Please login again.");
      return;
    }

    try {
      setChangePasswordLoading(true);
      const res = await axios.put(
        "http://localhost:5000/api/customers/change-password",
        {
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setChangePasswordSuccess(res?.data?.message || "Password changed successfully.");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (err) {
      setChangePasswordError(
        err?.response?.data?.message || "Failed to change password. Please try again."
      );
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const canChangePassword = isLoggedIn && customer?.authProvider !== "google";

  return (
    <>
      <nav className="navbar">
        {/* LEFT */}
        <div className="nav-left">
          <h1 className="logo">Oibre</h1>

          <button
            className="mobile-menu-toggle"
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? "\u2715" : "\u2630"}
          </button>

          <div className={`nav-links ${mobileMenuOpen ? "mobile-open" : ""}`}>
            <Link to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
            <Link to="/services" onClick={() => setMobileMenuOpen(false)}>Services</Link>
            <Link to="/about" onClick={() => setMobileMenuOpen(false)}>About</Link>
            <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>Contact</Link>
          </div>
        </div>

        {/* RIGHT */}
        <div className="nav-actions" ref={dropdownRef}>
          <div className="location-wrapper">
            <div className="location-pill" title={location.label || "Detecting..."}>
              {location.label || "Detecting..."}
            </div>
            <button
              className="change-location-btn"
              onClick={() => setIsConfirmed(true)}
            >
              Change
            </button>
            {isConfirmed && (
              <MapPicker
                initialLat={location.lat}
                initialLng={location.lng}
                onClose={() => setIsConfirmed(false)}
                onConfirm={(lat, lng, label) => {
                  const loc = {
                    lat,
                    lng,
                    label: label || "Pinned location",
                    address: label || "Pinned location",
                    locality: label || "Pinned location",
                    type: "manual"
                  };
                  setLocation(loc);
                  // persist so other pages (SearchResults, ProviderProfile) use it
                  try {
                    localStorage.setItem("userLocation", JSON.stringify(loc));
                  } catch (e) {
                    console.warn("Could not save userLocation", e);
                  }
                  persistLocationToServer(loc);
                  // notify other parts of the app
                  window.dispatchEvent(new Event("userLocationChanged"));
                  setUserLocationSet(true);
                  setIsConfirmed(false);
                }}
              />
            )}
          </div>

          {isLoggedIn ? (
            /* WHEN LOGGED IN - NOTIFICATION + PROFILE */
            <>
              {/* NOTIFICATION BELL */}
              <div className="notification-wrapper" ref={notificationRef}>
                <button
                  className="notification-btn"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev);
                    setProfileOpen(false);
                  }}
                  title="Notifications"
                >
                  <span className="notification-icon" aria-hidden="true">&#128276;</span>
                  {unreadCount > 0 && (
                    <span className="notification-badge">{unreadCount}</span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="notifications-dropdown">
                    <div className="notifications-header">Notifications</div>
                    {notifications.length === 0 ? (
                      <p className="no-notifications">
                        No notifications yet.
                        <br />
                        Booking updates will appear here.
                      </p>
                    ) : (
                      <div className="notifications-list">
                        {notifications.map((n) => (
                          <button
                            key={n._id}
                            className={`notification-item ${n.read ? "read" : "unread"}`}
                            onClick={() => {
                              if (!n.read) markNotificationRead(n._id);
                              setNotificationsOpen(false);
                              navigate("/orders");
                            }}
                            type="button"
                          >
                            {n.message}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PROFILE MENU */}
              <div className="profile-wrapper" ref={profileRef}>
                <button
                  className="profile-btn-circle"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                  title="Profile Menu"
                >
                  {customer?.name?.charAt(0)?.toUpperCase() || "U"}
                </button>

                {profileOpen && (
                  <div className="profile-dropdown-new">
                    <div className="profile-header">
                      <div className="profile-avatar">
                        {customer?.name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="profile-name">{customer?.name}</p>
                        <p className="profile-mobile">{customer?.mobile}</p>
                      </div>
                    </div>
                    <hr />
                    <Link to="/profile" className="profile-link">
                      View Profile
                    </Link>
                    <Link to="/orders" className="profile-link">
                      My Orders
                    </Link>
                    {canChangePassword && (
                      <button
                        type="button"
                        className="profile-action-btn"
                        onClick={handleOpenChangePassword}
                      >
                        Change Password
                      </button>
                    )}
                    <button onClick={handleLogout} className="logout-btn">
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* WHEN NOT LOGGED IN */
            <Link to="/auth">
              <button className="login-btn">Login / Signup</button>
            </Link>
          )}
        </div>
      </nav>

      {showChangePasswordModal && (
        <div className="cp-modal-overlay" onClick={handleCloseChangePassword}>
          <div className="cp-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Change Password</h3>
            <p className="cp-modal-subtitle">Update your account password securely.</p>
            <form onSubmit={handlePasswordChangeSubmit} className="cp-form">
              <label htmlFor="currentPassword">Current Password</label>
              <div className="password-input-wrap">
                <input
                  id="currentPassword"
                  type={showPassword.current ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))
                  }
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

              <label htmlFor="newPassword">New Password</label>
              <div className="password-input-wrap">
                <input
                  id="newPassword"
                  type={showPassword.next ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))
                  }
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

              <label htmlFor="confirmPassword">Confirm New Password</label>
              <div className="password-input-wrap">
                <input
                  id="confirmPassword"
                  type={showPassword.confirm ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))
                  }
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

              {changePasswordError && <p className="cp-error">{changePasswordError}</p>}
              {changePasswordSuccess && <p className="cp-success">{changePasswordSuccess}</p>}

              <div className="cp-actions">
                <button
                  type="button"
                  className="cp-btn-cancel"
                  onClick={handleCloseChangePassword}
                  disabled={changePasswordLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="cp-btn-save" disabled={changePasswordLoading}>
                  {changePasswordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
