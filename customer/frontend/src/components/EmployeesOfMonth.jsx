import { useEffect, useState } from "react";
import "../styles/employees.css";

export default function EmployeesOfMonth() {
  const [index, setIndex] = useState(0);

  const employees = [
    {
      name: "Ramesh Naik",
      role: "Electrician",
      rating: "⭐ 4.8",
      badge: "Employee of the Month",
      image: "/employees/ramesh.png",
      experience: "6+ years experience",
    },
    {
      name: "Suresh Kamat",
      role: "Plumber",
      rating: "⭐ 4.9",
      badge: "Top Performer",
      image: "/employees/suresh.png",
      experience: "8+ years experience",
    },
    {
      name: "Mahesh Dessai",
      role: "Carpenter",
      rating: "⭐ 4.7",
      badge: "Customer Favourite",
      image: "/employees/mahesh.png",
      experience: "10+ years experience",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % employees.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [employees.length]);

  const emp = employees[index];

  return (
    <section className="eom-showcase">
      <h2 className="eom-heading">🏆 Employee of the Month</h2>
      <p className="eom-subheading">
        Celebrating our top-rated professionals
      </p>

      {/* CARD */}
      <div className="eom-card-hero">
        {/* IMAGE */}
        <div className="eom-image">
          <img src={emp.image} alt={emp.name} />
        </div>

        {/* INFO */}
        <div className="eom-info">
          <span className="eom-badge">{emp.badge}</span>
          <h3>{emp.name}</h3>
          <p className="eom-role">{emp.role}</p>
          <p className="eom-exp">{emp.experience}</p>
          <p className="eom-rating">{emp.rating}</p>
        </div>
      </div>

      {/* dots removed per request */}
    </section>
  );
}
