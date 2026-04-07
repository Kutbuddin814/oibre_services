import { useEffect, useState } from "react";
import api from "../config/axios";
import { useNavigate } from "react-router-dom";
import { Heart, Star, MapPin, ExternalLink, Trash2, Bookmark } from "lucide-react";

export default function Favorites() {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
      }
    };
    fetchFavorites();
  }, []);

  const removeFavorite = async (id) => {
    try {
      const token = localStorage.getItem("customerToken");
      await api.post(
        "/chatbot/favorites/remove",
        { providerId: id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProviders((prev) => prev.filter((p) => p._id !== id));
    } catch (err) {
      console.error("Remove failed", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12">
      {/* Header Section */}
      <div className="max-w-7xl mx-auto mb-10">
        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <Bookmark className="text-rose-500 w-8 h-8" />
          Saved Providers
        </h2>
        <p className="text-slate-500 mt-2">Manage your curated list of top-rated service experts.</p>
      </div>

      {loading ? (
        <div className="flex justify-center mt-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : providers.length === 0 ? (
        <div className="max-w-md mx-auto flex flex-col items-center justify-center mt-20 p-10 bg-white rounded-3xl shadow-sm border border-dashed border-slate-300">
          <div className="bg-rose-50 p-6 rounded-full mb-4">
            <Heart className="w-12 h-12 text-rose-300" />
          </div>
          <p className="text-xl font-semibold text-slate-800">Your list is empty</p>
          <p className="text-slate-500 text-center mt-2">Start exploring and save your favorite providers for quick access.</p>
          <button 
            onClick={() => navigate('/services')}
            className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-full hover:bg-slate-800 transition shadow-lg"
          >
            Browse Services
          </button>
        </div>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 max-w-7xl mx-auto">
          {providers.map((p) => (
            <div
              key={p._id}
              className="group relative bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden"
            >
              {/* Card Decoration */}
              <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-500 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="p-6">
                {/* Header: Name & Remove */}
                <div className="flex justify-between items-start mb-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-400">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <button
                    onClick={() => removeFavorite(p._id)}
                    className="p-2 rounded-full bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors duration-200"
                    title="Remove from favorites"
                  >
                    <Heart className="w-5 h-5 fill-current" />
                  </button>
                </div>

                {/* Content */}
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                    Verified Provider
                  </span>
                  <h3 className="text-xl font-bold text-slate-800 mt-2 group-hover:text-blue-600 transition-colors">
                    {p.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 mt-4 text-slate-600 text-sm">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-amber-400 fill-current" />
                      <span className="font-semibold text-slate-800">{p.averageRating || "New"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span>Vasco Da Gama</span>
                    </div>
                  </div>

                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900">₹{p.basePrice || "0"}</span>
                    <span className="text-slate-400 text-xs font-medium">/ service</span>
                  </div>
                </div>

                {/* Footer Action */}
                <button 
                  onClick={() => navigate(`/provider/${p._id}`)}
                  className="w-full mt-6 py-3 bg-slate-50 group-hover:bg-blue-600 group-hover:text-white text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-all duration-200"
                >
                  View Profile
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}