import "./Footer.css"

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">H</div>
          <div>
            <p>HRMS Racing</p>
            <span>The next-gen horse racing analytics portal.</span>
          </div>
        </div>

        <div className="footer-links">
          <div>
            <p>Race</p>
            <a href="#">Upcoming Events</a>
            <a href="#">Entries</a>
            <a href="#">Results</a>
          </div>
          <div>
            <p>Insights</p>
            <a href="#">Horse Stats</a>
            <a href="#">Jockey Rankings</a>
            <a href="#">News</a>
          </div>
          <div>
            <p>Support</p>
            <a href="#">Features</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>© 2024 Prism. All rights reserved.</span>
        <div className="footer-socials">
          <a href="#">X</a>
          <a href="#">in</a>
          <a href="#">ig</a>
          <a href="#">fb</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
