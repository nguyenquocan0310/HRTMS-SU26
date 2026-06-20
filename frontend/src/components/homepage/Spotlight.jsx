import "./Spotlight.css"

const horseLeaders = [
  {
    name: "Black Comet",
    record: "8 wins - 2 places",
    details: "Excels in shorter turf races with quick acceleration and strong finish."
  },
  {
    name: "Storm Charger",
    record: "7 wins - 1 place",
    details: "Dominates classic distance races with excellent pacing and endurance."
  },
  {
    name: "Midnight Legend",
    record: "6 wins - 3 places",
    details: "Known for powerful late sprint and consistency under pressure."
  }
]

const jockeyLeaders = [
  {
    name: "L. Martin",
    rating: "95%",
    details: "Master of tactical rides, especially on wet tracks and tight turns."
  },
  {
    name: "A. Rivera",
    rating: "92%",
    details: "Exceptional consistency in stakes races and strong pace control."
  },
  {
    name: "S. Hunt",
    rating: "90%",
    details: "Recognized for excellent finishing sprints and race positioning."
  }
]

function Spotlight() {
  return (
    <section className="spotlight" id="statistics">
      <div className="spotlight-header">
        <span>Statistics</span>
        <h2>Top horses and jockeys in the season</h2>
        <p>
          Discover the standout horses with winning records and the jockeys with the highest ratings.
        </p>
      </div>

      <div className="spotlight-grid">
        <div className="spotlight-card spotlight-card--left">
          <h3>Horse Spotlight</h3>
          <p className="spotlight-card-description">
            Leading equine athletes with exceptional performance, stamina and track records.
          </p>

          {horseLeaders.map((horse, index) => (
            <div className="spotlight-item" key={index}>
              <div>
                <strong>{horse.name}</strong>
                <p>{horse.details}</p>
              </div>
              <span>{horse.record}</span>
            </div>
          ))}
        </div>

        <div className="spotlight-card spotlight-card--right">
          <h3>Jockey Spotlight</h3>
          <p className="spotlight-card-description">
            Elite jockeys with superior race strategy, win rates and consistent performance.
          </p>

          {jockeyLeaders.map((jockey, index) => (
            <div className="spotlight-item" key={index}>
              <div>
                <strong>{jockey.name}</strong>
                <p>{jockey.details}</p>
              </div>
              <span>{jockey.rating}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Spotlight
