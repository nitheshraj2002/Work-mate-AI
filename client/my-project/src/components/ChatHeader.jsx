// src/components/ChatHeader.jsx
import React from "react";
import "./ChatHeader.css";
// Accept onToggleSidebar prop and add this button inside .chat-header:
<button className="hamburger-btn" onClick={onToggleSidebar}>☰</button>
const ChatHeader = () => {
  return (
    <div className="chat-header">
      <div className="header-title">
        <img
          src="/logo192.png"
          alt="Logo"
          className="chat-logo"
        />
         Chatty Bot
      </div>
      
    </div>
  );
};

export default ChatHeader;
