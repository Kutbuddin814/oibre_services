import React from "react";

const Sidebar = ({ currentPage, setCurrentPage, isOpen, setSidebarOpen }) => {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "\uD83D\uDCCA" },
    { id: "services", label: "Services", icon: "\u2699\uFE0F" },
    { id: "provider-requests", label: "Provider Requests", icon: "\u2705" },
    { id: "removal-requests", label: "Removal Requests", icon: "\uD83D\uDDD1\uFE0F" },
    { id: "users", label: "Users", icon: "\uD83D\uDC65" },
    { id: "providers", label: "Service Providers", icon: "\uD83D\uDD27" },
    { id: "contact-messages", label: "Contact Messages", icon: "\u2709\uFE0F" }
  ];

  return (
    <aside className={`sidebar ${isOpen ? "open" : "closed"}`}>
      <ul className="sidebar-menu">
        {menuItems.map((item) => (
          <li key={item.id}>
            <button
              className={`menu-item ${currentPage === item.id ? "active" : ""}`}
              onClick={() => {
                setCurrentPage(item.id);
                if (window.innerWidth <= 768) {
                  setSidebarOpen(false);
                }
              }}
            >
              <span className="menu-icon">{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
};

export default Sidebar;
