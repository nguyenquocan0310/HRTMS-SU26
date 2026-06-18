import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  return (
    <header className="navbar">
      <Link to="/" className="navbar__brand">
        <div className="navbar__logo">H</div>
        <div>
          <span className="navbar__title">HRMS</span>
          <span className="navbar__subtitle">Racing</span>
        </div>
      </Link>

      <nav className="navbar__links">
        <Link to="/#features" className="navbar__link">Features</Link>
        <Link to="/#statistics" className="navbar__link">Statistics</Link>
        <Link to="/#news" className="navbar__link">News</Link>
      </nav>

      <div className="navbar__actions">
        <Link to="/login" className="navbar__login">Login</Link>
      </div>
    </header>
  )
}

export default Navbar
