import { Link } from 'react-router-dom'
import './Home.css'

export default function Home() {
  return (
    <div className="home-page">
      <header className="home-navbar">
        <div className="brand">
          <span className="brand-logo">H</span>
          <div>
            <strong>HRMS</strong>
            <small>Racing</small>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#statistics">Statistics</a>
          <a href="#news">News</a>
        </nav>

        <Link to="/login" className="cta-button">
          Login
        </Link>
      </header>

      <main className="home-hero">
        <div className="hero-copy">
          <span className="eyebrow">HRMS Racing</span>
          <h1>The new breed of thoroughbred racing analytics</h1>
          <p>
            Track standout horses, monitor jockey performance and manage race entries with a system built for racing teams.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="hero-button primary">
              Get started
            </Link>
            <a href="#features" className="hero-button secondary">
              See solutions
            </a>
          </div>
        </div>

        <div className="hero-cards">
          <div className="hero-card">
            <strong>1200+</strong>
            <p>Races tracked</p>
          </div>
          <div className="hero-card">
            <strong>98%</strong>
            <p>Team adoption</p>
          </div>
          <div className="hero-card">
            <strong>24/7</strong>
            <p>Race operations support</p>
          </div>
        </div>
      </main>

      <section id="features" className="home-section">
        <div className="section-title">
          <span>Built for race teams</span>
          <h2>Everything your team needs in one place</h2>
          <p>
            From owners to referees and doctors, HRMS centralizes race planning, horse reports and team collaboration.
          </p>
        </div>

        <div className="feature-grid">
          <article>
            <h3>Horse & Jockey Management</h3>
            <p>Track horse profiles, jockey assignments and performance data in one dashboard.</p>
          </article>
          <article>
            <h3>Race Scheduling</h3>
            <p>Plan events, assign referees and monitor race entries with precision.</p>
          </article>
          <article>
            <h3>Medical & Safety</h3>
            <p>Manage doctor reports, injury tracking and pre-race health checks seamlessly.</p>
          </article>
        </div>
      </section>

      <section id="statistics" className="home-section home-section-alt">
        <div className="stats-grid">
          <div>
            <strong>2.5k</strong>
            <p>Registered athletes</p>
          </div>
          <div>
            <strong>4.8/5</strong>
            <p>User satisfaction</p>
          </div>
          <div>
            <strong>15+</strong>
            <p>Integrated workflows</p>
          </div>
        </div>
      </section>

      <section id="news" className="home-section">
        <div className="section-title section-title-small">
          <span>News</span>
          <h2>Latest updates from the track</h2>
        </div>

        <div className="news-grid">
          <article>
            <strong>New race analytics</strong>
            <p>Our latest update gives you performance forecast for every entry.</p>
          </article>
          <article>
            <strong>Team collaboration</strong>
            <p>Secure, role-based access for owners, referees and medical staff.</p>
          </article>
          <article>
            <strong>Faster registrations</strong>
            <p>Register horses, jockeys and support staff with a streamlined workflow.</p>
          </article>
        </div>
      </section>
    </div>
  )
}
