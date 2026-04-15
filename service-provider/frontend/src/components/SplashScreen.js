import React from "react";
import "../styles/SplashScreen.css";
import { DotLottieReact } from "@lottiefiles/dotlottie-react";

export default function SplashScreen({ onStart }) {
  return (
    <div className="splash-container">
      <div className="splash-content">
        <DotLottieReact
          src="https://lottie.host/6fa1a899-d8e9-44c5-b08e-7ede3bcb7adf/xbcOg7nIzQ.lottie"
          loop
          autoplay
          style={{ width: 200, margin: "0 auto" }}
        />
        <h1>Oibre Service Provider</h1>
        <p>Join our network of trusted service providers</p>

        <div className="splash-features">
          <div className="feature">
            <span>📱</span>
            <h3>Easy Registration</h3>
            <p>Simple and fast registration process</p>
          </div>
          <div className="feature">
            <span>💼</span>
            <h3>Manage Services</h3>
            <p>Organize and promote your services</p>
          </div>
          <div className="feature">
            <span>⭐</span>
            <h3>Build Reputation</h3>
            <p>Get reviews and grow your business</p>
          </div>
        </div>

        <button className="splash-button" onClick={onStart}>
          Get Started
        </button>
      </div>
    </div>
  );
}
