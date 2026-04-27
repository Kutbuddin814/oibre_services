import "../styles/About.css";

export default function About() {
  return (
    <div className="about-page">
      {/* HERO SECTION */}
      <section className="about-hero">
        <h1>About Oibre</h1>
        <p>Connecting people with trusted service providers across Goa.</p>
      </section>

      {/* MAIN CONTENT */}
      <div className="about-container">
        {/* STORY */}
        <section className="about-section">
          <h2>Our Story</h2>
          <p>
            Oibre was founded with a simple mission: to make quality services accessible to everyone. We recognized the gap between customers needing reliable services and professionals struggling to find consistent work. By creating a platform that bridges this gap, we've built a community where trust, quality, and convenience come first.
          </p>
        </section>

        {/* MISSION & VISION */}
        <div className="mission-vision">
          <div className="card">
            <h3>🎯 Our Mission</h3>
            <p>To provide accessible, affordable, and reliable services by connecting verified professionals with customers across Goa.</p>
          </div>
          <div className="card">
            <h3>🌟 Our Vision</h3>
            <p>To become the most trusted service platform in India, empowering both consumers and service providers to thrive together.</p>
          </div>
        </div>

        {/* VALUES */}
        <section className="about-section">
          <h2>Our Core Values</h2>
          <div className="values-grid">
            <div className="value-item">
              <div className="value-icon">🤝</div>
              <h3>Trust</h3>
              <p>We build trust through transparency, verification, and consistent quality in every interaction.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">💼</div>
              <h3>Professionalism</h3>
              <p>Our service providers are trained, verified, and committed to delivering excellence.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">⚡</div>
              <h3>Efficiency</h3>
              <p>Quick response times, easy booking, and seamless service delivery every time.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">💰</div>
              <h3>Fairness</h3>
              <p>Fair pricing for customers and fair compensation for our service professionals.</p>
            </div>
          </div>
        </section>

        {/* STATS */}
        <section className="stats-section">
          <div className="stat">
            <h3>10K+</h3>
            <p>Happy Customers</p>
          </div>
          <div className="stat">
            <h3>2K+</h3>
            <p>Service Providers</p>
          </div>
          <div className="stat">
            <h3>30K+</h3>
            <p>Services Completed</p>
          </div>
          <div className="stat">
            <h3>4.8/5</h3>
            <p>Average Rating</p>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="about-section">
          <h2>How It Works</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Search</h3>
              <p>Browse and search for services you need in your area.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Book</h3>
              <p>Select a verified professional and book their services instantly.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Experience</h3>
              <p>Enjoy quality service from verified and rated professionals.</p>
            </div>
            <div className="step">
              <div className="step-number">4</div>
              <h3>Rate</h3>
              <p>Share your experience and help others find great services.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="about-cta">
          <h2>Ready to Get Started?</h2>
          <p>Join thousands of customers who trust Oibre for their service needs.</p>
          <div className="cta-buttons">
            <a href="/services" className="btn btn-primary">Find Services</a>
            <a href="/contact" className="btn btn-secondary">Contact Us</a>
          </div>
        </section>
      </div>
    </div>
  );
}
