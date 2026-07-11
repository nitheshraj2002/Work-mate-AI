import React, { useState, useEffect } from "react";
import ChatApp from "./components/ChatApp";
import Login from "./components/Login";
import "./App.css";


function App() {
  const [user, setUser] = useState(null);

  // Check if user already logged in
  useEffect(() => {
    const userId   = localStorage.getItem("user_id");
    const role     = localStorage.getItem("role");
    const username = localStorage.getItem("username");  // ← NEW

    if (userId && role) {
      setUser({ user_id: userId, role: role, username: username });  // ← NEW: added username
    }
  }, []);

  // Logout function
  const logout = () => {
    localStorage.removeItem("user_id");
    localStorage.removeItem("role");
    localStorage.removeItem("username");  // ← NEW: clear username on logout
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <ChatApp user={user} logout={logout} />;
}

export default App;