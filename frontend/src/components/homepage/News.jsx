import "./News.css"

const newsItems = [
  {
    title: "Racing season heats up with championship qualifiers",
    category: "Race",
    summary: "Top stables prepare final entries as the championship calendar tightens."
  },
  {
    title: "New training techniques boost jockey performance",
    category: "Jockey",
    summary: "Coaches focus on recovery and split-second strategy for winning rides."
  },
  {
    title: "Elite horses dominate the latest turf events",
    category: "Horse",
    summary: "Standout thoroughbreds deliver record-breaking finishes this month."
  }
]

function News() {
  return (
    <section className="news" id="news">
      <div className="news-header">
        <span>News</span>
        <h2>Latest updates in racing, jockeys and horse performance</h2>
      </div>

      <div className="news-grid">
        {newsItems.map((item, index) => (
          <article className="news-card" key={index}>
            <div className="news-card-meta">{item.category}</div>
            <h3>{item.title}</h3>
            <p>{item.summary}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

export default News
