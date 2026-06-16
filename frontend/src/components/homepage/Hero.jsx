import { Link } from "react-router-dom"
import "./Hero.css"

function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="hero-eyebrow">HRMS Racing</span>
          <h1>The new breed of thoroughbred racing analytics</h1>
          <p>
            Track standout horses, monitor jockey performance and manage race entries with a system built for racing teams.
          </p>
          <div className="hero-actions">
            <Link to="/login" className="hero-button">Get started</Link>
            <a href="#solutions" className="hero-link">See solutions</a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;