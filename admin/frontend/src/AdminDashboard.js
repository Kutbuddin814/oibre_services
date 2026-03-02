import React, { useState } from "react";
import "./styles/AdminDashboard.css";
import Sidebar from "./components/Sidebar";
import Navbar from "./components/AdminNavbar";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import ProviderRequests from "./pages/ProviderRequests";
import Users from "./pages/Users";
import Providers from "./pages/Providers";
import RemovalRequests from "./pages/RemovalRequests";
import ContactMessages from "./pages/ContactMessages";

const AdminDashboard = ({ admin, onLogout }) => {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);

  return (
    <div className="admin-container">
      <Navbar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        admin={admin}
        onLogout={onLogout}
      />
      <div className={`admin-main ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}>
        <Sidebar
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          isOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />
        <div className="admin-content">
          {currentPage === "dashboard" && <Dashboard setCurrentPage={setCurrentPage} />}
          {currentPage === "services" && <Services />}
          {currentPage === "provider-requests" && <ProviderRequests />}
          {currentPage === "removal-requests" && <RemovalRequests />}
          {currentPage === "users" && <Users />}
          {currentPage === "providers" && <Providers />}
          {currentPage === "contact-messages" && <ContactMessages />}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
