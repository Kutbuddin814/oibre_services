import React, { useState } from "react";
import api from "../api";

const AdminAuth = ({ onLogin }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    adminKey: ""
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const onChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSignup = async () => {
    try {
      const res = await api.post("/admin/auth/signup", {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        adminKey: form.adminKey
      });
      setMessage("Signup successful. You can now log in.");
      setIsSignup(false);
      setForm((prev) => ({ ...prev, password: "", adminKey: "" }));
    } catch (err) {
      throw err;
    }
  };

  const handleLogin = async () => {
    try {
      const res = await api.post("/admin/auth/login", {
        email: form.email.trim(),
        password: form.password
      });
      localStorage.setItem("adminToken", res.data.token);
      onLogin(res.data.admin);
    } catch (err) {
      throw err;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      if (isSignup) {
        await handleSignup();
      } else {
        await handleLogin();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Request failed";
      console.error("Auth error:", err);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-page">
      <form className="admin-auth-card" onSubmit={onSubmit}>
        <h1>Oibre Admin</h1>
        <p>{isSignup ? "Create a new admin account" : "Login to continue"}</p>

        {isSignup && (
          <input
            type="text"
            name="name"
            placeholder="Full name"
            value={form.name}
            onChange={onChange}
            required
          />
        )}

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={onChange}
          required
        />

        <div className="password-input-wrap">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={onChange}
            minLength={6}
            required
          />
          <button
            type="button"
            className="password-toggle-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            &#128065;
          </button>
        </div>

        {isSignup && (
          <input
            type="text"
            name="adminKey"
            placeholder="Admin signup key"
            value={form.adminKey}
            onChange={onChange}
            required
          />
        )}

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-success">{message}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : isSignup ? "Create Admin" : "Login"}
        </button>

        <button
          type="button"
          className="switch-btn"
          onClick={() => {
            setError("");
            setMessage("");
            setIsSignup((prev) => !prev);
          }}
        >
          {isSignup ? "Already have an account? Login" : "Need an account? Signup"}
        </button>
      </form>
    </div>
  );
};

export default AdminAuth;
