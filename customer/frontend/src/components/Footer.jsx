import { Link } from "react-router-dom";
import "../styles/footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* LEFT: Brand, Address, Contact */}
          <div className="footer-left">
            <Link to="/" className="footer-brand-link">
              <h2 className="footer-brand">Oibre</h2>
            </Link>
            <div className="footer-address">
              <p>Trusted local professionals at your doorstep</p>
              <p>Goa, India</p>
            </div>
            <div className="footer-contact">
              <div>
                <strong>Phone number</strong>
                <p>+91-9876-543-210</p>
              </div>
              <div>
                <strong>Email</strong>
                <p>support@oibre.com</p>
              </div>
            </div>
          </div>

          {/* RIGHT: 3 Columns */}
          <div className="footer-right">
            <div className="footer-column">
              <h4>Quick links</h4>
              <ul>
                <li><Link to="/">Home</Link></li>
                <li><Link to="/search">Services</Link></li>
                <li><Link to="/about">About us</Link></li>
                <li><Link to="/faq">FAQ</Link></li>
                <li><Link to="/contact">Contact us</Link></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Social</h4>
              <ul>
                <li><a href="https://facebook.com/oibre" target="_blank" rel="noopener noreferrer">Facebook</a></li>
                <li><a href="https://instagram.com/oibre" target="_blank" rel="noopener noreferrer">Instagram</a></li>
                <li><a href="https://linkedin.com/company/oibre" target="_blank" rel="noopener noreferrer">LinkedIn</a></li>
                <li><a href="https://twitter.com/oibre" target="_blank" rel="noopener noreferrer">Twitter</a></li>
                <li><a href="https://youtube.com/@oibre" target="_blank" rel="noopener noreferrer">Youtube</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Legal</h4>
              <ul>
                <li><Link to="/terms">Terms of service</Link></li>
                <li><Link to="/privacy">Privacy policy</Link></li>
                <li><Link to="/cookies">Cookie policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Oibre. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
