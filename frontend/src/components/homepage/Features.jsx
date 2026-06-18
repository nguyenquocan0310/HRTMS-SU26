import "./Features.css";

const features = [
  {
    title: "Race Entry Management",
    description:
      "Schedule races, assign entries and manage starting gates with precision."
  },
  {
    title: "Horse Performance",
    description:
      "Track speed, stamina and race form for each thoroughbred."
  },
  {
    title: "Jockey Analytics",
    description:
      "Analyze rider strengths, win rates and course specialty performance."
  },
  {
    title: "Trainer Insights",
    description:
      "Monitor training progress, conditioning and competition readiness."
  },
  {
    title: "Race Results",
    description:
      "View results, payouts and historical performance in one dashboard."
  },
  {
    title: "Stable Notes",
    description:
      "Capture horse health updates, gear changes and race-day strategies."
  }
];

function Features() {
  return (
    <section className="features" id="features">

      <h2>System Features</h2>

      <div className="feature-grid">

        {features.map((feature, index) => (
          <div className="feature-card" key={index}>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </div>
        ))}

      </div>
    </section>
  );
}

export default Features;