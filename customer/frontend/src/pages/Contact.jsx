import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import "../styles/Contact.css";

const initialForm = {
  name: "",
  email: "",
  phone: "",
  subject: "",
  message: ""
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[0-9\s-]{8,20}$/;

export default function Contact() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [serverError, setServerError] = useState("");
  const [lockedIdentity, setLockedIdentity] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("customerToken");
    if (!token) return;

    const applyCustomer = (customer) => {
      if (!customer) return;
      setForm((prev) => ({
        ...prev,
        name: customer.name || prev.name,
        email: customer.email || prev.email,
        phone: customer.mobile || prev.phone
      }));
      setLockedIdentity(Boolean(customer.name || customer.email || customer.mobile));
    };

    try {
      const cached = localStorage.getItem("customerData");
      if (cached) {
        const parsed = JSON.parse(cached);
        applyCustomer(parsed);
      }
    } catch (err) {
      console.warn("Could not parse cached customerData", err);
    }

    axios
      .get("http://localhost:5000/api/customers/me", {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then((res) => {
        applyCustomer(res.data);
      })
      .catch(() => {
        // Keep cached data if available.
      });
  }, []);

  const messageLength = useMemo(() => form.message.trim().length, [form.message]);

  const validateForm = () => {
    const nextErrors = {};

    if (!form.name.trim()) nextErrors.name = "Full name is required.";
    if (!form.email.trim()) nextErrors.email = "Email address is required.";
    if (!form.phone.trim()) nextErrors.phone = "Phone number is required.";
    if (!form.subject.trim()) nextErrors.subject = "Subject is required.";
    if (!form.message.trim()) nextErrors.message = "Message is required.";

    if (form.email.trim() && !EMAIL_REGEX.test(form.email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }

    if (form.phone.trim() && !PHONE_REGEX.test(form.phone.trim())) {
      nextErrors.phone = "Enter a valid phone number.";
    }

    if (form.subject.trim().length > 140) {
      nextErrors.subject = "Subject must be 140 characters or less.";
    }

    if (form.message.trim() && form.message.trim().length < 10) {
      nextErrors.message = "Message must be at least 10 characters.";
    }

    if (form.message.trim().length > 2000) {
      nextErrors.message = "Message must be 2000 characters or less.";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (lockedIdentity && (name === "name" || name === "email" || name === "phone")) return;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (serverError) setServerError("");
    if (success) setSuccess("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setLoading(true);
      setServerError("");
      await axios.post("http://localhost:5000/api/contact", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim()
      });

      setSuccess("Thanks. Your message has been sent. We will get back to you soon.");
      setForm((prev) => ({
        ...prev,
        subject: "",
        message: ""
      }));
      setErrors({});
    } catch (error) {
      const message = error.response?.data?.message || "Failed to send message. Please try again.";
      setServerError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      <section className="contact-hero">
        <h1>Get in Touch</h1>
        <p>We'd love to hear from you. Send us a message and we'll respond as soon as possible.</p>
      </section>

      <div className="contact-container">
        <div className="contact-info">
          <h2>Contact Information</h2>

          <div className="info-item">
            <div className="info-icon">📍</div>
            <div>
              <h3>Address</h3>
              <p>Goa, India</p>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">📞</div>
            <div>
              <h3>Phone</h3>
              <p>+91-9876-543-210</p>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">✉️</div>
            <div>
              <h3>Email</h3>
              <p>support@oibre.com</p>
            </div>
          </div>

          <div className="info-item">
            <div className="info-icon">⏰</div>
            <div>
              <h3>Hours</h3>
              <p>
                Monday - Friday: 9:00 AM - 6:00 PM
                <br />
                Saturday: 10:00 AM - 4:00 PM
                <br />
                Sunday: Closed
              </p>
            </div>
          </div>

          <div className="social-links">
            <h3>Follow Us</h3>
            <div className="social-icons">
              <a href="#" title="Facebook" aria-label="Facebook">
                f
              </a>
              <a href="#" title="X" aria-label="X">
                X
              </a>
              <a href="#" title="Instagram" aria-label="Instagram">
                ◎
              </a>
              <a href="#" title="LinkedIn" aria-label="LinkedIn">
                in
              </a>
            </div>
          </div>
        </div>

        <div className="contact-form-wrapper">
          {success && <div className="success-message">✅ {success}</div>}
          {serverError && <div className="error-message">❌ {serverError}</div>}

          <form onSubmit={handleSubmit} className="contact-form" noValidate>
            {lockedIdentity && (
              <div className="identity-locked-note">
                Using your account contact details. You can edit these from Profile.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="name">Full Name *</label>
              <input
                id="name"
                type="text"
                name="name"
                placeholder="Your name"
                value={form.name}
                onChange={handleChange}
                maxLength={100}
                disabled={lockedIdentity}
                className={lockedIdentity ? "locked-field" : ""}
                aria-invalid={Boolean(errors.name)}
              />
              {errors.name && <small className="field-error">{errors.name}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address *</label>
              <input
                id="email"
                type="email"
                name="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={handleChange}
                maxLength={120}
                disabled={lockedIdentity}
                className={lockedIdentity ? "locked-field" : ""}
                aria-invalid={Boolean(errors.email)}
              />
              {errors.email && <small className="field-error">{errors.email}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone Number *</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                placeholder="+91-XXXXXXXXXX"
                value={form.phone}
                onChange={handleChange}
                maxLength={20}
                disabled={lockedIdentity}
                className={lockedIdentity ? "locked-field" : ""}
                aria-invalid={Boolean(errors.phone)}
              />
              {errors.phone && <small className="field-error">{errors.phone}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="subject">Subject *</label>
              <input
                id="subject"
                type="text"
                name="subject"
                placeholder="What is this about?"
                value={form.subject}
                onChange={handleChange}
                maxLength={140}
                aria-invalid={Boolean(errors.subject)}
              />
              {errors.subject && <small className="field-error">{errors.subject}</small>}
            </div>

            <div className="form-group">
              <label htmlFor="message">Message *</label>
              <textarea
                id="message"
                name="message"
                placeholder="Your message here..."
                rows="6"
                value={form.message}
                onChange={handleChange}
                maxLength={2000}
                aria-invalid={Boolean(errors.message)}
              />
              <div className="message-meta">
                {errors.message ? (
                  <small className="field-error">{errors.message}</small>
                ) : (
                  <small className="char-count">{messageLength}/2000</small>
                )}
              </div>
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
