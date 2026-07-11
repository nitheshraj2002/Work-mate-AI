// src/components/ChatSidebar.jsx
import React, { useState, useEffect } from "react";
import { FaTrash, FaBars, FaTimes, FaSignOutAlt, FaPlus } from "react-icons/fa";
import "./ChatSidebar.css";

const ChatSidebar = ({
  conversations,
  selectChat,
  startNewConversation,
  deleteConversation,
  logout,
  selectedChatIndex,
  user,
}) => {
  const [showPopup, setShowPopup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 640) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when sidebar is open on mobile
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {/* ── Hamburger Button (mobile only) ── */}
      <button
        className="hamburger-btn"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <FaBars />
      </button>

      {/* ── Overlay (mobile — closes sidebar on tap) ── */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={closeSidebar} />
      )}

      {/* ── Sidebar ── */}
      <div className={`chat-sidebar ${sidebarOpen ? "open" : ""}`}>

        {/* Close button (mobile only) */}
        <button
          className="sidebar-close-btn"
          onClick={closeSidebar}
          aria-label="Close menu"
        >
          <FaTimes />
        </button>

        {/* LOGO */}
        <div className="sidebar-logo">
          <img src="/logo.png" alt="Chatbot Logo" />
          <span>ChattyBot</span>
        </div>

        {/* USER INFO + ROLE */}
        {user && (
          <div className="user-info">
            <div className={`role-badge ${user?.role?.toLowerCase()}`}>
              {user?.role?.charAt(0).toUpperCase()}
            </div>
            <div className="user-info-text">
              <p className="user-info-name">{user.username}</p>
              <p className="user-info-role">{user.role}</p>
            </div>
          </div>
        )}

        {/* NEW CHAT */}
        <button className="new-chat-btn" onClick={() => { startNewConversation(); closeSidebar(); }}>
          <FaPlus size={11} /> New Chat
        </button>

        {/* SECTION LABEL */}
        <p className="sidebar-section-label">Recent</p>

        {/* CONVERSATIONS */}
        <div className="conversation-list">
          {conversations.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: "13px", padding: "8px 10px" }}>
              No conversations yet.
            </p>
          )}
          {conversations.map((_, index) => (
            <div
              key={index}
              onClick={() => { selectChat(index); closeSidebar(); }}
              className={`conversation-item ${selectedChatIndex === index ? "selected" : ""}`}
            >
              <span className="conversation-item-text">Conversation {index + 1}</span>
              <span
                className="delete-icon"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(index);
                }}
                title="Delete"
              >
                <FaTrash size={12} />
              </span>
            </div>
          ))}
        </div>

        {/* BOTTOM — Logout */}
        <div className="sidebar-bottom">
          <button className="logout-btn" onClick={() => setShowPopup(true)}>
            <FaSignOutAlt size={13} /> Logout
          </button>
        </div>

      </div>

      {/* ── Logout Popup ── */}
      {showPopup && (
        <div className="popup-overlay">
          <div className="popup-box">
            <h3>Logout</h3>
            {user && (
              <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: "6px" }}>
                {user.username} &middot; <span style={{ textTransform: "capitalize" }}>{user.role}</span>
              </p>
            )}
            <p>Are you sure you want to logout?</p>
            <div className="popup-buttons">
              <button className="cancel-btn" onClick={() => setShowPopup(false)}>
                Cancel
              </button>
              <button
                className="confirm-btn"
                onClick={() => { setShowPopup(false); logout(); }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatSidebar;