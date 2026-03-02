import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/ProviderRegister.css";

/* VALIDATION HELPERS */
const isValidMobile = (mobile) => /^[6-9]\d{9}$/.test(mobile);
const isValidName = (name) => /^[A-Za-z\s]{3,50}$/.test(name);
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

/* TIME OPTIONS */
const TIME_OPTIONS = [
  "6:00 AM",
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM"
];

const FALLBACK_SERVICES = [
  { name: "Electrician", icon: "\u26A1" },
  { name: "Plumber", icon: "\uD83D\uDD27" },
  { name: "Cleaning", icon: "\uD83E\uDDF9" },
  { name: "Taxi", icon: "\uD83D\uDE95" },
  { name: "Carpenter", icon: "\uD83E\uDE9A" },
  { name: "Mechanic", icon: "\uD83D\uDD29" },
  { name: "AC Service", icon: "\uD83D\uDCA8" },
  { name: "Appliance Repair", icon: "\uD83D\uDEE0\uFE0F" },
  { name: "Painter", icon: "\uD83C\uDFA8" },
  { name: "Pest Control", icon: "\uD83D\uDC1C" },
  { name: "Laundry", icon: "\uD83E\uDDFA" },
  { name: "Salon at Home", icon: "\uD83D\uDC87" },
  { name: "Tutor", icon: "\uD83D\uDCDA" },
  { name: "Babysitter", icon: "\uD83D\uDC76" },
  { name: "Mover & Packer", icon: "\uD83D\uDCE6" }
];

const SERVICE_ICON_FALLBACKS = FALLBACK_SERVICES.reduce((acc, item) => {
  acc[item.name] = item.icon;
  return acc;
}, {});

const getServiceIcon = (service) => {
  const raw = service?.icon || "";
  if (!raw || /Ã|ðŸ|â|Â/.test(raw)) {
    return SERVICE_ICON_FALLBACKS[service?.name] || "\uD83D\uDD27";
  }
  return raw;
};

const ProviderRegister = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    qualification: "",
    serviceCategory: "",
    otherService: "",
    address: "",
    experience: "",
    description: ""
  });

  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const [services, setServices] = useState([]);
  const [files, setFiles] = useState({
    profilePhoto: null,
    skillCertificate: null
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [emailOtp, setEmailOtp] = useState({
    code: "",
    sending: false,
    sent: false,
    verifying: false,
    verified: false,
    otpId: "",
    error: ""
  });
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMessage, setOtpMessage] = useState("");

  useEffect(() => {
    if (!resendTimer) return;
    const timerId = setInterval(() => {
      setResendTimer((t) => Math.max(0, t - 1));
    }, 1000);
    return () => clearInterval(timerId);
  }, [resendTimer]);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const res = await axios.get("http://localhost:5000/api/services");
      const list = Array.isArray(res.data) ? res.data : [];
      setServices(list);
    } catch (err) {
      console.error("Failed to fetch services:", err);
      setError("Failed to load services. Please try again later.");
    } finally {
      setLoadingServices(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (e.target.name === "address") {
      setLocationQuery(e.target.value);
    }
    if (e.target.name === "email") {
      setEmailOtp({
        code: "",
        sending: false,
        sent: false,
        verifying: false,
        verified: false,
        otpId: ""
      });
      setResendTimer(0);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (e.target.name === "profilePhoto" && !file.type.startsWith("image/")) {
      setError("Profile photo must be an image");
      return;
    }

    if (
      e.target.name === "skillCertificate" &&
      !(file.type.startsWith("image/") || file.type === "application/pdf")
    ) {
      setError("Skill certificate must be an image or PDF");
      return;
    }

    setError("");
    setFiles({ ...files, [e.target.name]: file });
  };

  const getReadableLocation = async (lat, lng) => {
    const coordsFallback = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

    const buildAddressFromParts = (address) => {
      if (!address) return "";
      const parts = [
        address.road,
        address.suburb || address.neighbourhood || address.hamlet,
        address.village || address.town || address.city || address.county,
        address.state,
        address.country
      ].filter(Boolean);
      return parts.join(", ");
    };

    try {
      const nominatimRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1&accept-language=en`
      );
      if (nominatimRes.ok) {
        const data = await nominatimRes.json();
        const fromParts = buildAddressFromParts(data?.address);
        const resolvedAddress = data?.display_name || fromParts;
        if (resolvedAddress) {
          return { address: resolvedAddress };
        }
      }
    } catch {
      // Fall through to secondary provider.
    }

    try {
      const backupRes = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      if (backupRes.ok) {
        const data = await backupRes.json();
        const parts = [
          data?.locality || data?.city || data?.principalSubdivision,
          data?.countryName
        ].filter(Boolean);
        if (parts.length) {
          return { address: parts.join(", ") };
        }
      }
    } catch {
      // Ignore and use coordinate fallback.
    }

    return { address: coordsFallback };
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationError("");
    setDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const readable = await getReadableLocation(lat, lng);
        const address = readable?.address || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setFormData((prev) => ({ ...prev, address }));
        setLocationQuery(address);
        setLocationError("");
        setDetectingLocation(false);
      },
      () => {
        setDetectingLocation(false);
        setLocationError("Could not detect your location. Please allow location permission.");
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const handleSelectSearchResult = (item) => {
    setFormData((prev) => ({ ...prev, address: item.address }));
    setLocationQuery(item.address);
    setLocationResults([]);
  };

  useEffect(() => {
    if (!locationQuery.trim() || locationQuery.trim().length < 2) {
      setLocationResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingLocations(true);
        setLocationError("");
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=${encodeURIComponent(
            locationQuery.trim()
          )}`
        );

        if (!res.ok) {
          setLocationResults([]);
          return;
        }

        const data = await res.json();
        const mapped = (data || []).map((item) => {
          const a = item.address || {};
          const primary =
            a.suburb ||
            a.neighbourhood ||
            a.village ||
            a.town ||
            a.city ||
            item.name ||
            (item.display_name ? item.display_name.split(",")[0] : "Location");

          const secondaryParts = [
            a.city || a.town || a.village || a.county || "",
            a.state || "",
            a.country || ""
          ].filter(Boolean);

          return {
            address: item.display_name,
            title: primary,
            subtitle: secondaryParts.join(", ")
          };
        });

        setLocationResults(mapped);
      } catch (e) {
        console.error("Location search failed", e);
        setLocationResults([]);
      } finally {
        setSearchingLocations(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [locationQuery]);

  const handleStartTimeChange = (e) => {
    const nextStart = e.target.value;
    setStartTime(nextStart);
    if (endTime) {
      const startIndex = TIME_OPTIONS.indexOf(nextStart);
      const endIndex = TIME_OPTIONS.indexOf(endTime);
      if (startIndex >= endIndex) {
        setEndTime("");
      }
    }
  };

  const availableEndTimes = startTime
    ? TIME_OPTIONS.slice(TIME_OPTIONS.indexOf(startTime) + 1)
    : TIME_OPTIONS.slice(1);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const availableTime = startTime && endTime ? `${startTime} - ${endTime}` : "";

    if (!isValidName(formData.name)) {
      setError("Name must contain only letters (min 3 characters)");
      return;
    }

    if (!isValidEmail(formData.email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!emailOtp.verified || !emailOtp.otpId) {
      setError("Please verify your email with OTP before submitting");
      return;
    }

    if (!isValidMobile(formData.mobile)) {
      setError("Enter a valid 10-digit Indian mobile number");
      return;
    }

    if (!formData.serviceCategory) {
      setError("Please select a service category");
      return;
    }

    if (formData.serviceCategory === "Other") {
      if (!formData.otherService.trim()) {
        setError("Please specify your service when selecting 'Other'");
        return;
      }
      if (formData.otherService.trim().length < 3) {
        setError("Service name must be at least 3 characters long");
        return;
      }
      if (!/^[A-Za-z\s]+$/.test(formData.otherService)) {
        setError("Service name should contain only letters and spaces");
        return;
      }
    }

    if (!formData.address.trim()) {
      setError("Please enter your address");
      return;
    }

    if (!availableTime) {
      setError("Please select your available time");
      return;
    }

    if (!files.profilePhoto || !files.skillCertificate) {
      setError("Please upload both profile photo and skill certificate");
      return;
    }

    try {
      setLoading(true);
      const data = new FormData();
      Object.keys(formData).forEach((key) => data.append(key, formData[key]));
      data.append("availableTime", availableTime);
      data.append("emailOtpId", emailOtp.otpId);

      data.append("profilePhoto", files.profilePhoto);
      data.append("skillCertificate", files.skillCertificate);

      const res = await axios.post(
        "http://localhost:5000/api/providers/register",
        data,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      onSuccess();

    } catch (error) {
      if (error.response?.status === 409) {
        const { message } = error.response.data;
        setError(message);

        if (error.response.data.field === "email") {
          document.querySelector("input[name='email']")?.focus();
        }
        if (error.response.data.field === "mobile") {
          document.querySelector("input[name='mobile']")?.focus();
        }
      } else {
        setError(error.response?.data?.message || "Failed to submit registration");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-container">
      <form className="register-form" onSubmit={handleSubmit}>
        <h2>Register as Service Provider</h2>
        <p>Offer your services in your locality</p>

        <div className="form-section">
          <h3>Personal Information</h3>
          <input
            name="name"
            placeholder="Full Name"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <input
            type="email"
            name="email"
            placeholder="Enter a valid email (e.g. name@gmail.com)"
            value={formData.email}
            onChange={handleChange}
            className={emailOtp.verified ? "email-input-verified" : ""}
            required
          />

          {formData.email && (
            <>
              <div className="otp-row">
            <button
              type="button"
              className={`otp-btn ${emailOtp.verified ? "send-otp-btn-verified" : ""}`}
              onClick={async () => {
                console.log("Send OTP clicked", formData.email);
                setOtpMessage("");
                setError("");
                if (!isValidEmail(formData.email)) {
                  setError("Please enter a valid email address");
                  return;
                }

                // Check if email already exists (approved or pending)
                try {
                  console.log("calling /exists");
                  setOtpMessage("Checking email availability...");
                  const check = await axios.get("http://localhost:5000/api/providers/exists", {
                    params: { email: formData.email },
                    timeout: 5000
                  });
                  console.log("/exists response", check?.data);
                  if (check.data?.exists) {
                    const msg = check.data.status === "approved"
                      ? "Email already registered and approved. Please login or use another email."
                      : check.data.status === "pending"
                        ? "Email already submitted and pending approval. No need to request OTP."
                        : "Email already exists. No need to request OTP.";
                    setError(msg);
                    setOtpMessage(msg);
                    return;
                  }
                } catch (e) {
                  console.warn("Email exists check failed", e?.message || e);
                  // continue to try sending OTP even if exists check fails
                }

                try {
                  console.log("calling /email-otp/send");
                  setOtpMessage("Sending OTP...");
                  setEmailOtp((prev) => ({ ...prev, sending: true }));
                  const res = await axios.post(
                    "http://localhost:5000/api/providers/email-otp/send",
                    { email: formData.email },
                    { timeout: 10000 }
                  );
                  console.log("/email-otp/send response", res?.data);

                  if (res.data?.otp) {
                    setOtpMessage(`OTP (dev): ${res.data.otp}`);
                  } else {
                    setOtpMessage("OTP sent — check your email (or spam folder)");
                  }

                  setEmailOtp((prev) => ({ ...prev, sending: false, sent: true }));
                  setResendTimer(60);
                  setTimeout(() => {
                    document.querySelector("input[name='emailOtp']")?.focus();
                  }, 150);
                } catch (err) {
                  console.error("Send OTP error", err?.message || err, err?.response?.data);
                  setEmailOtp((prev) => ({ ...prev, sending: false }));
                  const msg = err?.response?.data?.message || err?.message || "Failed to send OTP";
                  setError(msg);
                  setOtpMessage("");
                  if (err?.response?.status === 429) setResendTimer(60);
                }
              }}
              disabled={emailOtp.sending || emailOtp.verified || resendTimer > 0}
            >
              {emailOtp.sending
                ? "Sending..."
                : emailOtp.verified
                ? "Verified"
                : resendTimer > 0
                ? `Resend in ${resendTimer}s`
                : "Send OTP"}
            </button>
            {otpMessage && (
              <div className={`otp-status ${
                otpMessage.includes("already") || otpMessage.includes("pending") || otpMessage.includes("exist") ? "error" : "success"
              }`}>
                {otpMessage}
              </div>
            )}
          </div>

          {emailOtp.sent && !emailOtp.verified && (
            <div>
              <div className="otp-row">
                <input
                  name="emailOtp"
                  className={`otp-input ${emailOtp.error ? "otp-input-error" : ""}`}
                  placeholder="Enter 6-digit code"
                  value={emailOtp.code}
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => {
                    // allow only digits
                    const v = e.target.value.replace(/[^0-9]/g, "");
                    setEmailOtp((prev) => ({ ...prev, code: v, error: "" }));
                  }}
                />
                <button
                  type="button"
                  className="otp-btn"
                  onClick={async () => {
                    if (!emailOtp.code.trim()) {
                      setError("Please enter the OTP");
                      return;
                    }
                    try {
                      setError("");
                      setEmailOtp((prev) => ({ ...prev, verifying: true, error: "" }));
                      const res = await axios.post(
                        "http://localhost:5000/api/providers/email-otp/verify",
                        { email: formData.email, otp: emailOtp.code.trim() }
                      );
                      setEmailOtp((prev) => ({
                        ...prev,
                        verifying: false,
                        verified: true,
                        otpId: res.data.otpId,
                        error: ""
                      }));
                      setResendTimer(0);
                      setOtpMessage("");
                    } catch (err) {
                      const errorMsg = err.response?.data?.message || "OTP verification failed";
                      setEmailOtp((prev) => ({ 
                        ...prev, 
                        verifying: false,
                        error: errorMsg.includes("invalid") || errorMsg.includes("wrong") || errorMsg.includes("incorrect") 
                          ? "❌ Incorrect OTP. Please try again."
                          : errorMsg.includes("expired")
                          ? "⏰ OTP has expired. Request a new one."
                          : "❌ " + errorMsg
                      }));
                      // Shake animation and auto-select for retry
                      const inp = document.querySelector("input[name='emailOtp']");
                      inp?.classList.add("shake-error");
                      setTimeout(() => inp?.classList.remove("shake-error"), 600);
                      setTimeout(() => inp?.select(), 100);
                    }
                  }}
                  disabled={emailOtp.verifying}
                >
                  {emailOtp.verifying ? "Verifying..." : "Verify OTP"}
                </button>
              </div>
              {emailOtp.error && (
                <div className="otp-error-message">
                  {emailOtp.error}
                </div>
              )}
            </div>
          )}



          {emailOtp.sent && !emailOtp.verified && resendTimer > 0 && (
            <div className="otp-status">You can request a new code in {resendTimer}s</div>
          )}
            </>
          )}

          <input
            name="mobile"
            placeholder="Mobile Number (10 digits)"
            value={formData.mobile}
            onChange={(e) => /^\d{0,10}$/.test(e.target.value) && handleChange(e)}
            required
          />

          <input
            name="qualification"
            placeholder="Qualification"
            value={formData.qualification}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-section">
          <h3>Service Information</h3>
          {loadingServices ? (
            <p style={{ color: "#999", textAlign: "center" }}>Loading services...</p>
          ) : (
            <>
              <select
                name="serviceCategory"
                value={formData.serviceCategory}
                onChange={handleChange}
                required
              >
                <option value="">Select Service</option>
                {(services.length ? services : FALLBACK_SERVICES).map((service) => (
                  <option key={service._id || service.name} value={service.name}>
                    {getServiceIcon(service)} {service.name}
                  </option>
                ))}
                <option value="Other">Other</option>
              </select>

              {formData.serviceCategory === "Other" && (
                <input
                  name="otherService"
                  placeholder="Specify Service"
                  value={formData.otherService}
                  onChange={handleChange}
                  required
                />
              )}
            </>
          )}

          <input
            name="address"
            placeholder="House No, Street, Area, City (e.g. Vasco, Goa)"
            value={formData.address}
            onChange={handleChange}
            required
          />

          <div className="location-actions">
            <button
              type="button"
              className="location-detect-btn"
              onClick={handleUseCurrentLocation}
              disabled={detectingLocation}
            >
              {detectingLocation ? "Detecting..." : "Detect my location"}
            </button>
            <span className="location-hint">Or type to search your address</span>
          </div>

          {locationError && (
            <div className="location-error">{locationError}</div>
          )}

          {locationResults.length > 0 && (
            <div className="location-results">
              {locationResults.map((location, idx) => (
                <button
                  type="button"
                  key={`${location.address}-${idx}`}
                  className="location-result-item"
                  onClick={() => handleSelectSearchResult(location)}
                >
                  <span className="location-result-title">{location.title}</span>
                  {location.subtitle && (
                    <span className="location-result-subtitle">{location.subtitle}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {searchingLocations && locationQuery.trim().length > 0 && (
            <div className="location-searching">Searching locations...</div>
          )}

          <select
            name="startTime"
            value={startTime}
            onChange={handleStartTimeChange}
            required
          >
            <option value="">Select Start Time</option>
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>

          <select
            name="endTime"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
            disabled={!startTime}
          >
            <option value="">Select End Time</option>
            {availableEndTimes.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>

          <input
            name="experience"
            placeholder="Experience (e.g. 5 years)"
            value={formData.experience}
            onChange={handleChange}
          />

          <textarea
            name="description"
            placeholder="Brief description of your services"
            value={formData.description}
            onChange={handleChange}
            rows="3"
          />
        </div>

        <div className="form-section">
          <h3>Documents</h3>
          <label style={{ fontSize: "12px", fontWeight: "600" }}>
            Profile Photo (Image)
          </label>
          <input
            type="file"
            name="profilePhoto"
            onChange={handleFileChange}
            accept="image/*"
            required
          />

          <label style={{ fontSize: "12px", fontWeight: "600" }}>
            Skill Certificate (PDF or Image)
          </label>
          <input
            type="file"
            name="skillCertificate"
            onChange={handleFileChange}
            accept="image/*,.pdf"
            required
          />
        </div>

        {error && <div className="error-message">{error}</div>}

        <button type="submit" disabled={loading || loadingServices}>
          {loading ? "Submitting..." : "Submit for Approval"}
        </button>
      </form>
    </div>
  );
};

export default ProviderRegister;
