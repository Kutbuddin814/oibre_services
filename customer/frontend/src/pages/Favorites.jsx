import { useEffect, useState } from "react";
import api from "../config/axios";

export default function Favorites() {
  const [providers, setProviders] = useState([]);

  useEffect(() => {
    const fetchFavorites = async () => {
      try {
        const token = localStorage.getItem("customerToken");

        const res = await api.get("/chatbot/favorites", {
          headers: { Authorization: `Bearer ${token}` }
        });

        setProviders(res.data.favorites || []);
      } catch (err) {
        console.error("Error fetching favorites", err);
      }
    };

    fetchFavorites();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>❤️ Saved Providers</h2>

      {providers.length === 0 ? (
        <p>No saved providers yet</p>
      ) : (
        providers.map((p) => (
          <div key={p._id} style={{
            border: "1px solid #ddd",
            padding: "10px",
            margin: "10px 0",
            borderRadius: "10px"
          }}>
            <h3>{p.name}</h3>
            <p>⭐ {p.rating ?? "N/A"}</p>
            <p>₹{p.price ?? "N/A"}</p>
          </div>
        ))
      )}
    </div>
  );
}