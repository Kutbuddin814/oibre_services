import React from "react";
import "../styles/SubmissionPending.css";

const SubmissionPending = () => {
  return (
    <div className="pending-container">
      <div className="pending-content">
        <div className="pending-icon">✓</div>
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
