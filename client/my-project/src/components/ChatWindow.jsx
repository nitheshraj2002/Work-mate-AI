// src/components/ChatWindow.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import "./ChatWindow.css";
import ThreeBackground from "./ThreeBackground";

// ── Flask backend URL ────────────────────────────────────────
const API_URL = "http://localhost:5001";

const ACCEPTED_TYPES = [
  "text/plain",
  "text/csv",
  "application/json",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

// ── Helpers ──────────────────────────────────────────────────
const playSound = (file) => {
  const audio = new Audio(file);
  audio.play().catch(() => {});
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12)  return "🌅 Good Morning";
  if (hour >= 12 && hour < 17) return "☀️ Good Afternoon";
  if (hour >= 17 && hour < 21) return "🌇 Good Evening";
  return "🌙 Good Night";
};

const formatTime = (date) =>
  date.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });

const formatDate = (date) =>
  date.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
  });

const makeMarkdownComponents = (theme) => {
  const isDark = theme === "dark";
  return {
    h1: ({ node, ...props }) => <h1 style={{ fontSize: "1.2em", fontWeight: "bold", margin: "8px 0 4px" }} {...props} />,
    h2: ({ node, ...props }) => <h2 style={{ fontSize: "1.1em", fontWeight: "bold", margin: "6px 0 4px" }} {...props} />,
    h3: ({ node, ...props }) => <h3 style={{ fontSize: "1em", fontWeight: "bold", margin: "4px 0" }} {...props} />,
    strong: ({ node, ...props }) => <strong style={{ fontWeight: "700", color: isDark ? "#00e9b2" : "#0f7a5a" }} {...props} />,
    em: ({ node, ...props }) => <em style={{ fontStyle: "italic", color: isDark ? "#02fa9f" : "#0a6b4f" }} {...props} />,
    ul: ({ node, ...props }) => <ul style={{ paddingLeft: "18px", margin: "6px 0" }} {...props} />,
    li: ({ node, ...props }) => <li style={{ margin: "3px 0", lineHeight: "1.5" }} {...props} />,
    ol: ({ node, ...props }) => <ol style={{ paddingLeft: "18px", margin: "6px 0" }} {...props} />,
    p: ({ node, ...props }) => <p style={{ margin: "4px 0", lineHeight: "1.6" }} {...props} />,
    code: ({ node, ...props }) => (
      <code style={{
        background: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.07)",
        borderRadius: "4px", padding: "1px 5px", fontSize: "0.9em",
        fontFamily: "monospace", color: isDark ? "#ff7eb3" : "#c0392b",
      }} {...props} />
    ),
    pre: ({ node, ...props }) => (
      <pre style={{
        background: isDark ? "#1e1e2e" : "#f4f4f8",
        color: isDark ? "#cdd6f4" : "#2d2d3a",
        borderRadius: "8px", padding: "12px", overflowX: "auto",
        fontSize: "0.85em", margin: "8px 0",
        border: isDark ? "none" : "1px solid rgba(0,0,0,0.08)",
      }} {...props} />
    ),
    blockquote: ({ node, ...props }) => (
      <blockquote style={{
        borderLeft: "4px solid #6c63ff", paddingLeft: "12px",
        margin: "6px 0", color: isDark ? "#ccc" : "#555", fontStyle: "italic",
      }} {...props} />
    ),
    table: ({ node, ...props }) => (
      <table style={{ borderCollapse: "collapse", width: "100%", margin: "8px 0", fontSize: "0.9em" }} {...props} />
    ),
    th: ({ node, ...props }) => (
      <th style={{ background: "#6c63ff", color: "white", padding: "6px 10px", textAlign: "left", fontWeight: "bold" }} {...props} />
    ),
    td: ({ node, ...props }) => (
      <td style={{
        padding: "5px 10px",
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgba(0,0,0,0.08)",
        color: isDark ? "#ddd" : "#333",
      }} {...props} />
    ),
    tr: ({ node, ...props }) => (
      <tr
        style={{ background: "transparent" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(108,99,255,0.12)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        {...props}
      />
    ),
    hr: ({ node, ...props }) => (
      <hr style={{
        border: "none",
        borderTop: isDark ? "1px solid rgba(255,255,255,0.15)" : "1px solid rgba(0,0,0,0.1)",
        margin: "8px 0",
      }} {...props} />
    ),
  };
};

const subMessages = [
  "Where should we begin?", "What's on your mind today?",
  "How can I help you today?", "Ready when you are! 🚀",
  "Ask me anything!", "Let's get started! 💡",
  "What would you like to explore?", "I'm all ears! 👂",
  "Got a question? Fire away!", "What can I do for you today? ✨",
  "Let's make something happen!", "Your wish is my command! 🌟",
  "What's the plan today?", "Tell me what you need! 💬",
  "How may I assist you? 🤝",
];

const getRandomSubMessage = () =>
  subMessages[Math.floor(Math.random() * subMessages.length)];

const EmptyState = ({ username, subMsg }) => (
  <div className="empty-state">
    <h1 className="empty-greeting">{getGreeting()},</h1>
    <h1 className="empty-username">{username}!</h1>
    <p className="empty-sub">{subMsg}</p>
    <div className="empty-chips">
      <span className="empty-chip">📋 My Tasks</span>
      <span className="empty-chip">📊 Reports</span>
      <span className="empty-chip">🤖 Ask AI</span>
      <span className="empty-chip">📅 Schedule</span>
    </div>
  </div>
);

const ThemeToggle = ({ theme, toggleTheme }) => (
  <button onClick={toggleTheme} className="theme-toggle-btn"
    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
    {theme === "dark" ? (
      <>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <span>Light</span>
      </>
    ) : (
      <>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
        <span>Dark</span>
      </>
    )}
  </button>
);

// ── Voice Input Hook ─────────────────────────────────────────
const useSpeechRecognition = (onResult) => {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported]     = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setSupported(true);
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e) => onResult(e.results[0][0].transcript);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => setIsListening(false);
    recognitionRef.current = recognition;
  }, [onResult]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return;
    recognitionRef.current.start();
    setIsListening(true);
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, [isListening]);

  return { isListening, supported, startListening, stopListening };
};

// ── Male Bot Voice ───────────────────────────────────────────
const getMaleVoice = () => {
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    "Microsoft David Desktop", "Microsoft Mark",
    "Google UK English Male", "Alex", "Daniel", "Fred",
  ];
  for (const name of preferred) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) return v;
  }
  const male = voices.find(
    (v) => v.lang.startsWith("en") && (
      v.name.toLowerCase().includes("male")  ||
      v.name.toLowerCase().includes("david") ||
      v.name.toLowerCase().includes("mark")  ||
      v.name.toLowerCase().includes("daniel")||
      v.name.toLowerCase().includes("james") ||
      v.name.toLowerCase().includes("alex")
    )
  );
  return male || voices.find((v) => v.lang.startsWith("en")) || voices[0];
};

const speakText = (text, onEnd) => {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text
    .replace(/[#*`_~>\-]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  const setVoiceAndSpeak = () => {
    const voice = window.speechSynthesis.getVoices()
  .find(v => v.name.includes("Microsoft David"));
    if (voice) utterance.voice = voice;
    utterance.lang    = "en-IN";
    utterance.rate    = 0.95;
    utterance.pitch   = 0.8;
    utterance.volume  = 1;
    if (onEnd) utterance.onend = onEnd;
    window.speechSynthesis.speak(utterance);
  };
  if (window.speechSynthesis.getVoices().length > 0) {
    setVoiceAndSpeak();
  } else {
    window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
  }
};

// ── SVG Icons ────────────────────────────────────────────────
const MicIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" fill="rgba(167,139,250,0.15)" stroke="#a78bfa"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" y1="19" x2="12" y2="23"/>
    <line x1="8"  y1="23" x2="16" y2="23"/>
  </svg>
);

const MicActiveIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <rect x="2"  y="8"  width="3" height="8"  rx="1.5" fill="#f87171" className="cw-wave-bar"/>
    <rect x="7"  y="4"  width="3" height="16" rx="1.5" fill="#f87171" className="cw-wave-bar" style={{ animationDelay: "0.1s" }}/>
    <rect x="12" y="6"  width="3" height="12" rx="1.5" fill="#f87171" className="cw-wave-bar" style={{ animationDelay: "0.2s" }}/>
    <rect x="17" y="3"  width="3" height="18" rx="1.5" fill="#f87171" className="cw-wave-bar" style={{ animationDelay: "0.15s" }}/>
  </svg>
);

const FileIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.44 11.05L12.25 20.24a5.5 5.5 0 0 1-7.78-7.78L13.64 4.3a3.5 3.5 0 0 1 4.95 4.95L9.41 18.42a1.5 1.5 0 0 1-2.12-2.12L16.07 7.6"
      fill="rgba(52,211,153,0.1)"/>
  </svg>
);

const FileAttachedIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" fill="rgba(52,211,153,0.15)"/>
    <polyline points="14 2 14 8 20 8"/>
    <polyline points="9 15 12 18 15 15"/>
  </svg>
);

const FileLoadingIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
      className="cw-spin-path"/>
  </svg>
);

const SpeakIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="rgba(251,191,36,0.15)" stroke="#fbbf24"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);

const SpeakActiveIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24">
    <rect x="5"  y="4" width="4" height="16" rx="1.5" fill="#fbbf24"/>
    <rect x="15" y="4" width="4" height="16" rx="1.5" fill="#fbbf24"/>
  </svg>
);

const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);

const AnalyseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

// ── Main Component ───────────────────────────────────────────
const ChatWindow = ({
  chat = [],
  onSendMessage,
  username = "User",
  role     = "user",
  theme    = "dark",
  toggleTheme,
}) => {
  const [message,      setMessage]      = useState("");
  const [useAI,        setUseAI]        = useState(false);
  const [currentTime,  setCurrentTime]  = useState(new Date());
  const [subMsg,       setSubMsg]       = useState(getRandomSubMessage);
  const [isSpeaking,   setIsSpeaking]   = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileLoading,  setFileLoading]  = useState(false);

  const fileInputRef = useRef(null);
  const endRef       = useRef(null);
  const markdownComponents = makeMarkdownComponents(theme);

  const handleVoiceResult = useCallback((transcript) => {
    setMessage((prev) => prev ? `${prev} ${transcript}` : transcript);
  }, []);

  const { isListening, supported, startListening, stopListening } =
    useSpeechRecognition(handleVoiceResult);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (chat.length === 0) setSubMsg(getRandomSubMessage());
  }, [chat.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
    if (chat.length > 0 && chat[chat.length - 1].sender === "bot") {
      playSound("/sounds/bot.mp3");
    }
  }, [chat]);

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const interval = setInterval(() => {
      setIsSpeaking(window.speechSynthesis.speaking);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ── Normal send ──────────────────────────────────────────
  const send = (e) => {
    e.preventDefault();
    if (selectedFile) { sendFile(); return; }
    if (!message.trim()) return;
    playSound("/sounds/send.mp3");
    onSendMessage(message, useAI);
    setMessage("");
  };

  // ── File selected ────────────────────────────────────────
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    e.target.value = "";
  };

  // ── Send file → Flask → Gemini ───────────────────────────
  const sendFile = async () => {
    if (!selectedFile || fileLoading) return;
    const userText = message.trim()
      ? `📎 ${selectedFile.name}\n💬 ${message.trim()}`
      : `📎 ${selectedFile.name}`;
    onSendMessage(userText, false);
    const question   = message;
    const fileToSend = selectedFile;
    setMessage("");
    setSelectedFile(null);
    setFileLoading(true);
    try {
      const formData = new FormData();
      formData.append("file",     fileToSend);
      formData.append("question", question);
      formData.append("role",     role);
      formData.append("username", username);
      const res  = await fetch(`${API_URL}/upload_file`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.reply) {
        onSendMessage(`__BOT__${data.reply}`, false);
      } else {
        onSendMessage(`__BOT__⚠️ Error: ${data.error || "Unknown error"}`, false);
      }
    } catch (err) {
      onSendMessage(`__BOT__⚠️ Failed to reach server: ${err.message}`, false);
    } finally {
      setFileLoading(false);
    }
  };

  const lastBotMessage = [...chat].reverse().find((m) => m.sender === "bot");

  const handleSpeak = () => {
    if (!lastBotMessage) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    } else {
      speakText(lastBotMessage.text, () => setIsSpeaking(false));
      setIsSpeaking(true);
    }
  };

  return (
    <div className="chat-window">
      <ThreeBackground modelPath="/chatbot.glb" useAI={useAI} />

      {/* TIME BAR */}
      <div className="chat-time-bar">
        <span className="chat-greeting">{getGreeting()}</span>
        <span className="chat-clock">🕐 {formatTime(currentTime)}</span>
        <span className="chat-date">📅 {formatDate(currentTime)}</span>
        {toggleTheme && <ThemeToggle theme={theme} toggleTheme={toggleTheme} />}
      </div>

      {/* MESSAGES */}
      <div className="messages">
        {chat.length === 0 && <EmptyState username={username} subMsg={subMsg} />}
        {chat.map((m, i) => (
          <div key={i} className={`message-container ${m.sender === "user" ? "user" : "bot"}`}>
            <img className="avatar"
              src={m.sender === "user" ? "/user.gif" : "/bot.png"}
              alt={m.sender === "user" ? "User" : "Bot"} />
            <div className={`message-bubble ${m.sender === "user" ? "user-bubble" : "bot-bubble"}`}>
              {m.sender === "bot"
                ? <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                : m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* INPUT BAR */}
      <form className="chat-input" onSubmit={send}>

        {/* 🎤 MIC BUTTON — circular icon only */}
        {supported && (
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            title={isListening ? "Stop listening" : "Speak your message"}
            className={`cw-icon-btn cw-mic-btn${isListening ? " cw-mic-btn--active" : ""}`}
          >
            {isListening ? <MicActiveIcon /> : <MicIcon />}
          </button>
        )}

        {/* 📎 FILE BUTTON — circular icon only */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="Attach file — TXT, CSV, XLSX, DOCX, JSON"
          className={`cw-icon-btn cw-file-btn${selectedFile ? " cw-file-btn--active" : ""}${fileLoading ? " cw-file-btn--loading" : ""}`}
          disabled={fileLoading}
        >
          {fileLoading ? <FileLoadingIcon /> : selectedFile ? <FileAttachedIcon /> : <FileIcon />}
          {selectedFile && !fileLoading && (
            <span
              className="cw-file-badge"
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              title="Remove file"
            >✕</span>
          )}
        </button>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        {/* TEXT INPUT */}
        <input
          className="cw-text-input"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={
            fileLoading    ? "⏳ Analysing your file…"
            : selectedFile ? `Ask about ${selectedFile.name}… (optional)`
            : isListening  ? "🎤 Listening…"
            : "Type your message..."
          }
          disabled={fileLoading}
        />

        {/* 🔊 SPEAK BUTTON — circular icon only */}
        {lastBotMessage && (
          <button
            type="button"
            onClick={handleSpeak}
            title={isSpeaking ? "Stop speaking" : "Read reply aloud"}
            className={`cw-icon-btn cw-speak-btn${isSpeaking ? " cw-speak-btn--active" : ""}`}
          >
            {isSpeaking ? <SpeakActiveIcon /> : <SpeakIcon />}
          </button>
        )}

        {/* USE AI TOGGLE */}
        <label className="ai-toggle">
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => {
              setUseAI(e.target.checked);
              playSound(e.target.checked ? "/sounds/ai-on.mp3" : "/sounds/ai-off.mp3");
            }}
          />
          Use AI
        </label>

        {/* SEND / ANALYSE */}
        <button
          type="submit"
          className={`cw-send-btn${selectedFile ? " cw-send-btn--analyse" : ""}`}
          disabled={fileLoading}
        >
          {selectedFile ? (
            <><AnalyseIcon /> Analyse</>
          ) : (
            <><SendIcon /> Send</>
          )}
        </button>

      </form>

      {/* ── Styles ── */}
      <style>{`

        /* ═══════════════════════════════════════════
           CIRCULAR ICON BUTTONS  (Mic / File / Speak)
           ═══════════════════════════════════════════ */

        .cw-icon-btn {
          width:           42px;
          height:          42px;
          border-radius:   50%;
          border:          1.5px solid transparent;
          cursor:          pointer;
          display:         flex;
          align-items:     center;
          justify-content: center;
          flex-shrink:     0;
          position:        relative;
          transition:      background 0.22s, border-color 0.22s,
                           transform 0.18s cubic-bezier(.4,0,.2,1),
                           box-shadow 0.22s;
          outline:         none;
        }

        .cw-icon-btn:hover {
          transform:  translateY(-2px) scale(1.08);
        }

        .cw-icon-btn:active {
          transform: scale(0.94);
        }

        /* ── MIC ────────────────────────── */
        .cw-mic-btn {
          background:   rgba(139, 99, 255, 0.12);
          border-color: rgba(139, 99, 255, 0.25);
        }

        .cw-mic-btn:hover {
          background:   rgba(139, 99, 255, 0.22);
          border-color: rgba(139, 99, 255, 0.50);
          box-shadow:   0 4px 14px rgba(139, 99, 255, 0.28);
        }

        .cw-mic-btn--active {
          background:   rgba(220, 38, 38, 0.20) !important;
          border-color: rgba(239, 68, 68, 0.55) !important;
          box-shadow:   0 0 0 0 rgba(239, 68, 68, 0.55);
          animation:    cw-mic-pulse 1.4s ease-in-out infinite !important;
        }

        @keyframes cw-mic-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(239,68,68,0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(239,68,68,0);   }
          100% { box-shadow: 0 0 0 0   rgba(239,68,68,0);    }
        }

        /* Animated waveform bars inside mic active */
        .cw-wave-bar {
          animation:        cw-wave-bounce 0.6s ease-in-out infinite alternate;
          transform-origin: bottom;
        }

        @keyframes cw-wave-bounce {
          from { transform: scaleY(0.45); opacity: 0.65; }
          to   { transform: scaleY(1.20); opacity: 1;    }
        }

        /* ── FILE ───────────────────────── */
        .cw-file-btn {
          background:   rgba(45, 212, 191, 0.10);
          border-color: rgba(45, 212, 191, 0.22);
        }

        .cw-file-btn:hover {
          background:   rgba(45, 212, 191, 0.20);
          border-color: rgba(45, 212, 191, 0.50);
          box-shadow:   0 4px 14px rgba(45, 212, 191, 0.22);
        }

        .cw-file-btn--active {
          background:   rgba(0, 233, 178, 0.18) !important;
          border-color: rgba(0, 233, 178, 0.55) !important;
          box-shadow:   0 0 12px rgba(0, 233, 178, 0.18);
        }

        .cw-file-btn--loading {
          opacity: 0.65;
          cursor:  wait !important;
          pointer-events: none;
        }

        /* Small red × badge on top-right of file btn when file attached */
        .cw-file-badge {
          position:        absolute;
          top:             -4px;
          right:           -4px;
          width:           16px;
          height:          16px;
          border-radius:   50%;
          background:      rgba(239, 68, 68, 0.85);
          color:           #fff;
          font-size:       9px;
          font-weight:     700;
          display:         flex;
          align-items:     center;
          justify-content: center;
          cursor:          pointer;
          transition:      background 0.15s, transform 0.15s;
          line-height:     1;
          border:          1.5px solid rgba(0,0,0,0.15);
        }

        .cw-file-badge:hover {
          background: rgba(239, 68, 68, 1);
          transform:  scale(1.2);
        }

        /* Spinning loader path */
        .cw-spin-path {
          animation:        cw-spin 1s linear infinite;
          transform-origin: center;
        }

        @keyframes cw-spin {
          from { transform: rotate(0deg);   }
          to   { transform: rotate(360deg); }
        }

        /* ── SPEAK ──────────────────────── */
        .cw-speak-btn {
          background:   rgba(251, 191, 36, 0.10);
          border-color: rgba(251, 191, 36, 0.22);
        }

        .cw-speak-btn:hover {
          background:   rgba(251, 191, 36, 0.20);
          border-color: rgba(251, 191, 36, 0.50);
          box-shadow:   0 4px 14px rgba(251, 191, 36, 0.22);
        }

        .cw-speak-btn--active {
          background:   rgba(251, 191, 36, 0.20) !important;
          border-color: rgba(251, 191, 36, 0.60) !important;
          animation:    cw-speak-glow 1.8s ease-in-out infinite !important;
        }

        @keyframes cw-speak-glow {
          0%, 100% { box-shadow: 0 0 6px  rgba(251,191,36,0.20); }
          50%       { box-shadow: 0 0 18px rgba(251,191,36,0.50); }
        }

        /* ═══════════════════════════════════════════
           TEXT INPUT
           ═══════════════════════════════════════════ */

        .cw-text-input {
          flex:         1;
          height:       42px;
          border-radius:22px;
          border:       1.5px solid rgba(255,255,255,0.10);
          background:   rgba(255,255,255,0.05);
          color:        inherit;
          font-size:    14px;
          font-family:  inherit;
          padding:      0 18px;
          outline:      none;
          transition:   border-color 0.2s, box-shadow 0.2s;
          min-width:    0;
        }

        .cw-text-input::placeholder { color: rgba(255,255,255,0.35); }

        .cw-text-input:focus {
          border-color: rgba(108, 99, 255, 0.55);
          box-shadow:   0 0 0 3px rgba(108, 99, 255, 0.12);
        }

        .cw-text-input:disabled {
          opacity: 0.55;
          cursor:  not-allowed;
        }

        /* ═══════════════════════════════════════════
           SEND / ANALYSE BUTTON
           ═══════════════════════════════════════════ */

        .cw-send-btn {
          height:        42px;
          padding:       0 20px;
          border-radius: 22px;
          border:        1.5px solid rgba(108, 99, 255, 0.45);
          background:    linear-gradient(135deg, #6c63ff, #818cf8);
          color:         #fff;
          font-size:     13.5px;
          font-weight:   600;
          font-family:   inherit;
          letter-spacing:0.3px;
          cursor:        pointer;
          display:       flex;
          align-items:   center;
          gap:           7px;
          flex-shrink:   0;
          transition:    transform 0.18s, box-shadow 0.22s, background 0.22s;
          box-shadow:    0 4px 14px rgba(108, 99, 255, 0.30);
        }

        .cw-send-btn:hover:not(:disabled) {
          background:  linear-gradient(135deg, #7c74ff, #9ca3f8);
          box-shadow:  0 6px 20px rgba(108, 99, 255, 0.45);
          transform:   translateY(-1px);
        }

        .cw-send-btn:active:not(:disabled) {
          transform: scale(0.96);
        }

        .cw-send-btn--analyse {
          background:  linear-gradient(135deg, #00e9b2, #00b89c) !important;
          border-color: rgba(0, 233, 178, 0.50) !important;
          box-shadow:  0 4px 14px rgba(0, 233, 178, 0.30) !important;
        }

        .cw-send-btn--analyse:hover:not(:disabled) {
          background:  linear-gradient(135deg, #00f5c0, #00c8aa) !important;
          box-shadow:  0 6px 20px rgba(0, 233, 178, 0.45) !important;
        }

        .cw-send-btn:disabled {
          opacity:   0.42;
          cursor:    not-allowed;
          transform: none !important;
        }

      `}</style>
    </div>
  );
};

export default ChatWindow;