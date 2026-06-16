import "../../pages/Home/Home.css"

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <h1>Horse Racing Management System</h1>

        <p>
          Manage horses, jockeys, owners and racing events
          in one powerful platform.
        </p>

        <button>Explore Races</button>
      </div>
    </section>
  );
}

export default Hero;