import { Link } from "react-router-dom"
import "./Hero.css"

function Hero() {
  return (
    <section className="hero">
      <div className="hero-overlay" />
      <div className="hero-inner">
        <div className="hero-copy">
          <span className="hero-eyebrow">Prism</span>
          <h1>The new breed of equine management</h1>
          <p>
            Introducing Prism — the most intelligent, affordable and scalable horse and stable management system.
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