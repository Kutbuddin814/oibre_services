import React from "react";
import "../styles/SubmissionPending.css";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

const SubmissionPending = () => {
  return (
    <div className="pending-container">
      <div className="pending-content">
        <DotLottieReact
          src="https://lottie.host/6fa1a899-d8e9-44c5-b08e-7ede3bcb7adf/xbcOg7nIzQ.lottie"
          loop={false}
          autoplay
          style={{ width: 120, margin: "0 auto" }}
        />
        <h1>Application Submitted!</h1>
        <p>Thank you for registering with Oibre</p>

        <div className="pending-message">
          <h3>What happens next?</h3>
          <ul>
            <li>We review your application</li>
            <li>We verify your credentials</li>
            <li>You receive login details via email</li>
            <li>Start accepting service requests</li>
          </ul>
        </div>

        <p className="pending-note">
          ⏱️ Approval typically takes 24-48 hours. Check your email regularly!
        </p>

        <div className="pending-footer">
          <p>Questions? Contact support@oibre.com</p>
        </div>
      </div>
    </div>
  );
};

export default SubmissionPending;
