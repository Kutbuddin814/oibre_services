import { useNavigate } from "react-router-dom";
import ServiceCard from "../components/ServiceCard";

export default function Providers() {
  const navigate = useNavigate();

  // 🔹 DEMO DATA (later replace with DB API)
  const providers = [
    {
      name: "Ramesh Naik",
      skill: "Electrician",
      rating: 4.6,
      experience: 6,
      distance: "1.2 km"
    },
    {
      name: "Suresh Kamat",
      skill: "Plumber",
      rating: 4.4,
      experience: 8,
      distance: "2 km"
    },
    {
      name: "Mahesh Dessai",
      skill: "Carpenter",
      rating: 4.7,
      experience: 10,
      distance: "900 m"
    }
  ];

  return (
    <section className="providers">
      <h2>Professionals Near You</h2>
      <div className="provider-grid">
        {providers.map((p, i) => (
          <div
            key={i}
            onClick={() => navigate(`/search?query=${p.skill.toLowerCase()}`)}
            style={{ cursor: "pointer" }}
          >
            <ServiceCard provider={p} />
          </div>
        ))}
      </div>
    </section>
  );
}
