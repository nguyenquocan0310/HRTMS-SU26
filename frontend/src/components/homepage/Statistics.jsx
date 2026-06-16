import "./Statistics.css";

const stats = [
  {
    number: 120,
    title: "Horses"
  },
  {
    number: 45,
    title: "Jockeys"
  },
  {
    number: 60,
    title: "Owners"
  },
  {
    number: 18,
    title: "Active Races"
  }
];

function Statistics() {
  return (
    <section className="stats" id="solutions">

      {stats.map((item, index) => (
        <div className="stat-card" key={index}>
          <h2>{item.number}</h2>
          <p>{item.title}</p>
        </div>
      ))}

    </section>
  );
}

export default Statistics;