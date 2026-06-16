const features = [
  {
    title: "Horse Management",
    description:
      "Manage horse profiles, breeds and race history."
  },
  {
    title: "Jockey Management",
    description:
      "Track jockey performance and assignments."
  },
  {
    title: "Race Scheduling",
    description:
      "Create and manage racing events."
  },
  {
    title: "Owner Management",
    description:
      "Manage horse ownership information."
  },
  {
    title: "Performance Tracking",
    description:
      "Analyze rankings and race results."
  },
  {
    title: "Medical Records",
    description:
      "Monitor horse health and vaccinations."
  }
];

function Features() {
  return (
    <section className="features">

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