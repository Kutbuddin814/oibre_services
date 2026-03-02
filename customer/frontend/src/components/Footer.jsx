import { Link } from "react-router-dom";
import "../styles/footer.css";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-content">
          {/* LEFT: Brand, Address, Contact */}
          <div className="footer-left">
            <h2 className="footer-brand">Oibre</h2>
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
                <li><a href="#">FAQ</a></li>
                <li><Link to="/contact">Contact us</Link></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Social</h4>
              <ul>
                <li><a href="#">Facebook</a></li>
                <li><a href="#">Instagram</a></li>
                <li><a href="#">LinkedIn</a></li>
                <li><a href="#">Twitter</a></li>
                <li><a href="#">Youtube</a></li>
              </ul>
            </div>

            <div className="footer-column">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Terms of service</a></li>
                <li><a href="#">Privacy policy</a></li>
                <li><a href="#">Cookie policy</a></li>
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
