import { Link } from 'react-router-dom'
import './Navbar.css'

function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar__brand">
        <div className="navbar__logo">P</div>
        <span className="navbar__title">Prism</span>
      </div>

      <nav className="navbar__links">
        <a href="#solutions" className="navbar__link">Solutions</a>
        <a href="#features" className="navbar__link">Features</a>
        <a href="#pricing" className="navbar__link">Pricing</a>
        <a href="#resources" className="navbar__link">Resources</a>
      </nav>

      <div className="navbar__actions">
        <Link to="/login" className="navbar__login">Login</Link>
      </div>
    </header>
  )
}

export default Navbar
