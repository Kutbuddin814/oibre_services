import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";



export default function Favorites() {
  const [providers, setProviders] = useState([]);
  const navigate = useNavigate();

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
  const removeFavorite = async (id) => {
  const token = localStorage.getItem("customerToken");

  await api.post(
    "/chatbot/favorites/remove",
    { providerId: id },
    { headers: { Authorization: `Bearer ${token}` } }
  );

  setProviders((prev) => prev.filter((p) => p._id !== id));
};

 return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
        <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800">
        ❤️ Saved Providers
        </h2>

        {providers.length === 0 ? (
        <div className="flex flex-col items-center justify-center mt-20 text-gray-500">
            <div className="text-6xl mb-4">💔</div>
            <p className="text-lg">No saved providers yet</p>
        </div>
        ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
            <div
                key={p._id}
                className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-all p-4 flex flex-col justify-between"
            >
                {/* Top */}
                <div>
                <h3 className="text-lg font-semibold text-gray-800">
                    {p.name}
                </h3>

                <div className="flex items-center gap-2 mt-2 text-yellow-500">
                    ⭐ <span className="text-gray-700">{p.rating ?? "N/A"}</span>
                </div>

                <p className="mt-2 text-gray-600">
                    Price: <span className="font-medium text-gray-800">₹{p.price ?? "N/A"}</span>
                </p>
                </div>

                {/* Bottom Buttons */}
                <div className="mt-4 flex justify-between items-center">
                <button 
                onClick={() => navigate(`/provider/${p._id}`)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition"
                >
                View
                </button>

                <button
                onClick={() => removeFavorite(p._id)}
                className="text-red-500 hover:scale-110 transition text-lg"
                >
                ❤️
                </button>
                </div>
            </div>
            ))}
        </div>
        )}
    </div>
    );
}