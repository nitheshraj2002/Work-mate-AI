import React, { useState, useCallback } from "react";
import axios from "axios";
import "./Login.css";

const API_URL = "http://localhost:5001";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) {
      setErrorMsg("Please enter username and password.");
      return;
    }

    setErrorMsg("");
    setLoading(true);

    try {
      const res = await axios.post(`${API_URL}/login`, {
        username: username.trim(),
        password: password.trim(),
      });

      const user = res.data;

      // ── DEBUG: see exactly what Flask returns ──
      console.log("=== LOGIN RESPONSE ===");
      console.log("user_id  :", user.user_id);
      console.log("role     :", user.role);
      console.log("username :", user.username);
      console.log("======================");

      // ── Save to localStorage ──
      localStorage.setItem("user_id",  user.user_id);
      localStorage.setItem("role",     user.role);
      localStorage.setItem("username", user.username);

      // ── DEBUG: verify localStorage saved correctly ──
      console.log("=== LOCALSTORAGE CHECK ===");
      console.log("user_id  :", localStorage.getItem("user_id"));
      console.log("role     :", localStorage.getItem("role"));
      console.log("username :", localStorage.getItem("username"));
      console.log("==========================");

      // ── Pass full user object to App ──
      onLogin({
        user_id:  user.user_id,
        role:     user.role,
        username: user.username,   // ✅ explicitly pass username
      });

      alert(`Login successful! Role: ${user.role} | Username: ${user.username}`);

    } catch (err) {
      if (err.response && err.response.data && err.response.data.error) {
        setErrorMsg(err.response.data.error);
      } else {
        setErrorMsg("Server error. Try again.");
      }
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }, [username, password, onLogin]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLogin();
      }
    },
    [handleLogin]
  );

  return (
    <div className="login-page">
      {/* Background effects */}
      <div className="bg-blob blob-teal" />
      <div className="bg-blob blob-purple" />
      <div className="bg-grid" />

      <div className="login-layout">

        {/* LEFT: Spline Robot */}
        <div className="robot-panel">
          <iframe
            src="https://my.spline.design/genkubgreetingrobot-cCS3P739OYL7s14etK3Zqxme/"
            frameBorder="0"
            width="100%"
            height="100%"
            title="Greeting Robot"
          />
          <div className="robot-caption">
            <h1>Hello,<br />Welcome.</h1>
            <p>Sign in to access your workspace</p>
          </div>
        </div>

        {/* RIGHT: Login Form */}
        <div className="form-panel">
          <div className="form-box">

            <div className="brand">
              <span className="brand-dot" />
              <span className="brand-name">PORTAL</span>
            </div>

            <h2>Sign In</h2>
            <p className="form-desc">Enter your credentials below</p>

            {errorMsg && <div className="error-msg">{errorMsg}</div>}

            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                placeholder="your_username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div className="password-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              className={`btn-login${loading ? " btn-loading" : ""}`}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? <span className="btn-spinner" /> : "Login"}
            </button>

            <p className="secure-note">🔒 Secured connection</p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;