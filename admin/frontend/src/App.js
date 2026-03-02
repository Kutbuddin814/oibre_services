import React, { useEffect, useState } from "react";
import AdminDashboard from "./AdminDashboard";
import AdminAuth from "./components/AdminAuth";
import api from "./api";

function App() {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/admin/auth/me")
      .then((res) => setAdmin(res.data))
      .catch(() => localStorage.removeItem("adminToken"))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    setAdmin(null);
  };

  if (loading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!admin) {
    return <AdminAuth onLogin={setAdmin} />;
  }

  return <AdminDashboard admin={admin} onLogout={handleLogout} />;
}

export default App;
