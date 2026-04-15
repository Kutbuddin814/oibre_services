import { useState } from "react";
import api from "./config/axios";
import { useNavigate } from "react-router-dom";
import "./ProviderStyles.css";
import Loader from "../components/Loader";
import OverlayLoader from "../components/OverlayLoader";

const ProviderLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedPassword = String(password || "").trim();

      const res = await api.post(
        "/provider/auth/login",
        { email: normalizedEmail, password: normalizedPassword }
      );

      localStorage.setItem("providerToken", res.data.token);
      sessionStorage.removeItem("providerLocationChosen");
      navigate("/dashboard");

    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    
    <div className="provider-login">
      <div className="login-card">
        <h2>Service Provider Login</h2>
        <p>Access your service provider dashboard</p>

        <form onSubmit={handleLogin}>
          <div className="login-form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="login-form-group">
            <label>Password</label>
            <div className="password-input-wrap">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProviderLogin;
