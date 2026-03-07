import { useState, useEffect } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import "../styles/CustomerAuth.css";

export default function CustomerAuth() {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [googleUser, setGoogleUser] = useState(null);
  const [resendTimer, setResendTimer] = useState(0);
  const [otpMessage, setOtpMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailOtp, setEmailOtp] = useState({
    code: "",
    sending: false,
    sent: false,
    verifying: false,
    verified: false,
    otpId: "",
    error: ""
  });

  const [form, setForm] = useState({
    name: "",
    email: "",
    address: "",
    locality: "",
    mobile: "",
    password: ""
  });

  /* ================= RESEND TIMER ================= */
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => {
      setResendTimer((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  const isGmail = (email) =>
    /@gmail\.com$/i.test(String(email || "")) ||
    /@googlemail\.com$/i.test(String(email || ""));

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === "email") {
      setEmailOtp({
        code: "",
        sending: false,
        sent: false,
        verifying: false,
        verified: false,
        otpId: "",
        error: ""
      });
      setOtpMessage("");
      setResendTimer(0);
    }
  };

  /* ================= GOOGLE AUTH ================= */
  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (isLogin) {
        // GOOGLE LOGIN
        const res = await api.post(
          "/customers/google-login",
          { email: user.email }
        );

        localStorage.setItem("customerToken", res.data.token);
        localStorage.setItem("customerData", JSON.stringify(res.data.customer));
        navigate("/");
        
        // Auto-reload page after short delay to ensure all components properly load customer data
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        // GOOGLE SIGNUP — CHECK EMAIL
        try {
          await api.post(
            "/customers/google-login",
            { email: user.email }
          );

          alert("Email already registered. Please login.");
          setIsLogin(true); // ✅ OK here (Google flow)
          setGoogleUser(null);
          return;
        } catch {
          // Email NOT registered → continue signup
          setGoogleUser(user);
          setForm({
            name: user.displayName || "",
            email: user.email,
            address: "",
            locality: "",
            mobile: "",
            password: ""
          });
        }
      }
    } catch (err) {
      console.error("Google auth error:", err);
      if (err.code === "auth/cancelled-popup-request") {
        alert("Google sign-in was cancelled. Please try again.");
      } else if (err.code === "auth/popup-blocked") {
        alert("Sign-in popup was blocked. Please allow popups and try again.");
      } else if (err.code === "auth/unauthorized-domain") {
        alert("This domain is not authorized for Google Sign-In. Please contact support.");
      } else {
        alert("Google authentication failed: " + (err.message || "Unknown error"));
      }
    }
  };

  /* ================= NORMAL SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      if (isLogin) {
        const res = await api.post(
          "/customers/login",
          {
            mobile: form.mobile,
            password: form.password
          }
        );

        localStorage.setItem("customerToken", res.data.token);
        localStorage.setItem("customerData", JSON.stringify(res.data.customer));
        navigate("/");
        
        // Auto-reload page after short delay to ensure all components properly load customer data
        setTimeout(() => {
          window.location.reload();
        }, 100);
      } else {
        if (!googleUser && form.email && !isGmail(form.email)) {
          if (!emailOtp.verified || !emailOtp.otpId) {
            alert("Please verify your email with OTP before signup.");
            return;
          }
        }

        await api.post(
          "/customers/register",
          { ...form, emailOtpId: emailOtp.otpId }
        );

        alert("Signup successful! Please login.");

        // after success → go to login
        setIsLogin(true);
        setGoogleUser(null);
        setForm({
          name: "",
          email: "",
          address: "",
          locality: "",
          mobile: "",
          password: ""
        });
        setEmailOtp({
          code: "",
          sending: false,
          sent: false,
          verifying: false,
          verified: false,
          otpId: "",
          error: ""
        });
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Something went wrong";

      alert(message);

      // 🔴 IMPORTANT FIX HERE
      // ❌ DO NOT switch to login automatically
      if (message.toLowerCase().includes("email")) {
        // stay on signup
        setGoogleUser(null);
        setForm((prev) => ({
          ...prev,
          email: "" // allow user to re-enter email
        }));
      }
    }
  };

  return (
    <div className="customer-auth-container">
      <div className="customer-auth-card">

        <h2 className="customer-auth-title">
          {isLogin ? "Customer Login" : "Customer Signup"}
        </h2>

        <form onSubmit={handleSubmit} className="customer-auth-form">
          {!isLogin && (
            <>
              <label htmlFor="customerName" className="form-field-label">Full Name</label>
              <input
                id="customerName"
                name="name"
                placeholder="Full Name"
                value={form.name}
                onChange={handleChange}
                required
                className="customer-email-input"
              />

              <label htmlFor="customerEmail" className="form-field-label">Email Address</label>
              <input
                id="customerEmail"
                name="email"
                placeholder="Email Address"
                value={form.email}
                onChange={handleChange}
                required
                disabled={!!googleUser}
                className={`customer-email-input ${emailOtp.verified && !isGmail(form.email) ? "customer-email-input-verified" : ""}`}
              />

              {!googleUser && form.email && (
                <>
                  <div className="customer-otp-row">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!form.email.trim()) {
                          alert("Please enter your email address");
                          return;
                        }
                        try {
                          setOtpMessage("Sending OTP...");
                          setEmailOtp((prev) => ({ ...prev, sending: true, error: "" }));
                          const res = await api.post(
                            "/customers/email-otp/send",
                            { email: form.email }
                          );
                          
                          setEmailOtp((prev) => ({
                            ...prev,
                            sending: false,
                            sent: true,
                            error: ""
                          }));
                          setResendTimer(60);
                          setOtpMessage("✓ OTP sent — check your email (or spam folder)");
                          
                          setTimeout(() => {
                            document.querySelector("input[name='customerEmailOtp']")?.focus();
                          }, 150);
                        } catch (err) {
                          setEmailOtp((prev) => ({ ...prev, sending: false }));
                          const msg = err.response?.data?.message || "Failed to send OTP";
                          setOtpMessage(msg);
                        }
                      }}
                      disabled={emailOtp.sending || emailOtp.verified || resendTimer > 0}
                      className={`customer-otp-btn ${emailOtp.verified ? "customer-otp-btn-verified" : ""}`}
                    >
                      {emailOtp.sending
                        ? "Sending..."
                        : emailOtp.verified
                        ? "✓ Verified"
                        : resendTimer > 0
                        ? `Resend in ${resendTimer}s`
                        : "Send OTP"}
                    </button>
                    {otpMessage && (
                      <div className={`customer-otp-status ${
                        otpMessage.includes("already") || otpMessage.includes("exist") ? "error" : "success"
                      }`}>
                        {otpMessage}
                      </div>
                    )}
                  </div>

                  {emailOtp.sent && !emailOtp.verified && (
                    <div>
                      <label htmlFor="customerEmailOtp" className="form-field-label">Email OTP</label>
                      <div className="customer-otp-row">
                        <input
                          id="customerEmailOtp"
                          name="customerEmailOtp"
                          className={`customer-otp-input ${emailOtp.error ? "customer-otp-input-error" : ""}`}
                          placeholder="Enter 6-digit code"
                          value={emailOtp.code}
                          inputMode="numeric"
                          maxLength={6}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^0-9]/g, "");
                            setEmailOtp((prev) => ({ ...prev, code: v, error: "" }));
                          }}
                        />
                        <button
                          type="button"
                          className="customer-otp-btn"
                          onClick={async () => {
                            if (!emailOtp.code.trim()) {
                              alert("Please enter the OTP");
                              return;
                            }
                            try {
                              setEmailOtp((prev) => ({ ...prev, verifying: true, error: "" }));
                              const res = await api.post(
                                "/customers/email-otp/verify",
                                { email: form.email, otp: emailOtp.code.trim() }
                              );
                              setEmailOtp((prev) => ({
                                ...prev,
                                verifying: false,
                                verified: true,
                                otpId: res.data.otpId,
                                error: ""
                              }));
                              setResendTimer(0);
                              setOtpMessage("✓ Email verified successfully!");
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
                              const inp = document.querySelector("input[name='customerEmailOtp']");
                              inp?.classList.add("customer-shake-error");
                              setTimeout(() => inp?.classList.remove("customer-shake-error"), 600);
                              setTimeout(() => inp?.select(), 100);
                            }
                          }}
                          disabled={emailOtp.verifying}
                        >
                          {emailOtp.verifying ? "Verifying..." : "Verify OTP"}
                        </button>
                      </div>
                      {emailOtp.error && (
                        <div className="customer-otp-error-message">
                          {emailOtp.error}
                        </div>
                      )}

                      {emailOtp.sent && !emailOtp.verified && resendTimer > 0 && (
                        <div className="customer-otp-status">
                          You can request a new code in {resendTimer}s
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              <label htmlFor="customerAddress" className="form-field-label">Address</label>
              <input
                id="customerAddress"
                name="address"
                placeholder="House No, Street, Landmark"
                value={form.address}
                onChange={handleChange}
                required
                className="customer-email-input"
              />

              <label htmlFor="customerLocality" className="form-field-label">Locality</label>
              <input
                id="customerLocality"
                name="locality"
                placeholder="Locality (e.g. Vasco, Panaji)"
                value={form.locality}
                onChange={handleChange}
                required
                className="customer-email-input"
              />
            </>
          )}

          <label htmlFor="customerMobile" className="form-field-label">Mobile Number</label>
          <input
            id="customerMobile"
            name="mobile"
            placeholder="Mobile Number"
            value={form.mobile}
            onChange={handleChange}
            required
            className="customer-email-input"
          />

          {!googleUser && (
            <div className="password-input-wrap">
              <label htmlFor="customerPassword" className="form-field-label">Password</label>
              <input
                id="customerPassword"
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                required
                className="customer-email-input"
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
          )}

          <button className="customer-signup-btn">
            {isLogin ? "Login" : "Signup"}
          </button>
        </form>

        <div className="customer-auth-divider">
          <div className="customer-auth-divider-line" />
          <span className="customer-auth-divider-text">OR</span>
          <div className="customer-auth-divider-line" />
        </div>

        <button
          type="button"
          onClick={handleGoogleAuth}
          className="customer-google-btn"
        >
          <img
            src="https://developers.google.com/identity/images/g-logo.png"
            className="w-5 h-5"
            alt="Google"
          />
          {isLogin ? "Login with Google" : "Signup with Google"}
        </button>

        <p className="text-center text-sm mt-4">
          {isLogin ? "Don’t have an account?" : "Already have an account?"}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setGoogleUser(null);
              setForm({
                name: "",
                email: "",
                address: "",
                locality: "",
                mobile: "",
                password: ""
              });              setEmailOtp({
                code: "",
                sending: false,
                sent: false,
                verifying: false,
                verified: false,
                otpId: "",
                error: ""
              });
              setOtpMessage("");
              setResendTimer(0);            }}
            className="text-blue-600 ml-1 font-medium"
          >
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}
