import Navbar from "../../components/homepage/Navbar";
import Hero from "../../components/homepage/Hero";
import Statistics from "../../components/homepage/Statistics";
import Features from "../../components/homepage/Features";
import Spotlight from "../../components/homepage/Spotlight";
import News from "../../components/homepage/News";
import Footer from "../../components/homepage/Footer";

function Home() {
  return (
    <>
      <Navbar />
      <Hero />
      <Statistics />
      <Features />
      <Spotlight />
      <News />
      <Footer />
    </>
  );
}

export default Home;