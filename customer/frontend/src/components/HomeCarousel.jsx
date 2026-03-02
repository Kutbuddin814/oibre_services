import { useEffect, useState } from "react";

const slides = [
  {
    title: "Services In Your Area",
    quote: "Trusted professionals, right where you live.",
    image: `${import.meta.env.BASE_URL}images/location-services.png`,
  },
  {
    title: "Verified & Reliable",
    quote: "Every professional is checked and reviewed.",
    image: `${import.meta.env.BASE_URL}images/verified-professionals.png`,
  },
  {
    title: "Fast & Easy Booking",
    quote: "No calls. No hassle. Just book.",
    image: `${import.meta.env.BASE_URL}images/easy-booking.png`,
  },
];

export default function HomeCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <section className="carousel-section">
      <div className="carousel-large">
        {/* TEXT */}
        <div className="carousel-content">
          <h2>{slides[index].title}</h2>
          <p className="quote">“{slides[index].quote}”</p>
        </div>

        {/* IMAGE */}
        <div className="carousel-image">
          <img
            src={slides[index].image}
            alt={slides[index].title}
          />
        </div>

        {/* dots removed per request */}
      </div>
    </section>
  );
}
