// src/components/ChatApp.jsx
import React, { useEffect, useState, useRef, useCallback } from "react";
import axios from "axios";
import ChatSidebar from "./ChatSidebar";
import ChatWindow from "./ChatWindow";
import FileUpload from "./FileUpload";          // ← NEW
import { useTheme } from "../hooks/useTheme";
import { getTheme } from "../theme/roleThemes";
import "./ChatApp.css";

const API_URL = "http://localhost:5001";

const MIN_SIDEBAR = 180;
const MAX_SIDEBAR = 400;
const DEFAULT_SIDEBAR = 260;

const ChatApp = ({ user, logout }) => {
  const userId = user?.user_id;
  const role = user?.role?.toLowerCase();
  const username = user?.username?.trim();

  // ── Theme (dark / light toggle) ────────────────────────
  const { theme, toggleTheme } = useTheme();

  // ── Apply role-based accent colors ─────────────────────
  useEffect(() => {
    const roleTheme = getTheme(role);
    const root = document.documentElement;
    root.style.setProperty("--accent",        roleTheme.accent);
    root.style.setProperty("--accent-dim",    roleTheme.accentDim);
    root.style.setProperty("--accent-glow",   roleTheme.accentGlow);
    root.style.setProperty("--bubble-user",   roleTheme.bubbleUser);
    root.style.setProperty("--bg-selected",   roleTheme.bgSelected);
    root.style.setProperty("--border-accent", roleTheme.borderAccent);
  }, [role]);

  const [conversations, setConversations] = useState([]);
  const [chats, setChats] = useState([]);
  const [selectedChatIndex, setSelectedChatIndex] = useState(0);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DEFAULT_SIDEBAR);

  // ── Detect screen resize ────────────────────────────────
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Sidebar drag resize ─────────────────────────────────
  const onMouseDown = useCallback((e) => {
    if (isMobile) return;
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = sidebarWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [sidebarWidth, isMobile]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.min(
        MAX_SIDEBAR,
        Math.max(MIN_SIDEBAR, startWidth.current + delta)
      );
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // ── Load conversations ──────────────────────────────────
  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await axios.get(`${API_URL}/conversations?user_id=${userId}`);
        const convs = res.data || [];
        setConversations(convs);
        setChats(convs.map(() => []));
        setSelectedChatIndex(0);
      } catch (err) {
        console.error("Load conversations error:", err);
      }
    };
    if (userId) fetchConversations();
  }, [userId]);

  // ── Load chat history ───────────────────────────────────
  useEffect(() => {
    const loadHistory = async () => {
      const conversationId = conversations[selectedChatIndex]?.conversation_id;
      if (!conversationId) return;
      try {
        const res = await axios.get(`${API_URL}/history?conversation_id=${conversationId}`);
        const rebuiltChat = [];
        (res.data || []).forEach((item) => {
          rebuiltChat.push({ sender: "user", text: item.user_message });
          if (item.bot_response) {
            rebuiltChat.push({ sender: "bot", text: item.bot_response });
          }
        });
        setChats((prev) =>
          prev.map((c, i) => (i === selectedChatIndex ? rebuiltChat : c))
        );
      } catch (err) {
        console.error("Load history error:", err);
      }
    };
    loadHistory();
  }, [selectedChatIndex, conversations]);

  // ── Send message ────────────────────────────────────────
  const handleSendMessage = async (message, useAI = false) => {

    // Handle Gemini file answer coming back from ChatWindow
    if (message.startsWith("__BOT__")) {
      const botText = message.replace("__BOT__", "");
      setChats((prev) =>
        prev.map((c, i) =>
          i === selectedChatIndex ? [...c, { sender: "bot", text: botText }] : c
        )
      );
      return;
    }

    let conversationId = conversations[selectedChatIndex]?.conversation_id;

    if (!conversationId) {
      try {
        const res = await axios.post(`${API_URL}/new_conversation`, {
          user_id: userId,
        });
        conversationId = res.data.conversation_id;
        setConversations([{ conversation_id: conversationId }]);
        setChats([[]]);
        setSelectedChatIndex(0);
      } catch (err) {
        console.error("Auto-create conversation failed:", err);
        return;
      }
    }

    setChats((prev) =>
      prev.map((c, i) =>
        i === selectedChatIndex ? [...c, { sender: "user", text: message }] : c
      )
    );

    try {
      let botReply;
      if (useAI) {
        const res = await axios.post(`${API_URL}/ai_chat`, {
          message,
          role,
          user_id: userId,
          username,
          conversation_id: conversationId,
        });
        botReply = res.data.reply;
      } else {
        const res = await axios.post(`${API_URL}/chat`, {
          user_id: userId,
          conversation_id: conversationId,
          message,
          role,
        });
        botReply = res.data.reply;
      }

      if (botReply) {
        setChats((prev) =>
          prev.map((c, i) =>
            i === selectedChatIndex
              ? [...c, { sender: "bot", text: botReply }]
              : c
          )
        );
      }
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  // ── NEW: FileUpload → push user & bot bubbles into chat ─
  const addUserMsg = (text) => {
    setChats((prev) =>
      prev.map((c, i) =>
        i === selectedChatIndex ? [...c, { sender: "user", text }] : c
      )
    );
  };

  const addBotMsg = (text) => {
    setChats((prev) =>
      prev.map((c, i) =>
        i === selectedChatIndex ? [...c, { sender: "bot", text }] : c
      )
    );
  };
  // ────────────────────────────────────────────────────────

  // ── New conversation ────────────────────────────────────
  const startNewConversation = async () => {
    try {
      const res = await axios.post(`${API_URL}/new_conversation`, {
        user_id: userId,
      });
      setConversations((prev) => {
        const updated = [...prev, { conversation_id: res.data.conversation_id }];
        setSelectedChatIndex(updated.length - 1);
        return updated;
      });
      setChats((prev) => [...prev, []]);
    } catch (err) {
      console.error("New chat error:", err);
    }
  };

  // ── Delete conversation ─────────────────────────────────
  const deleteConversation = async (index) => {
    if (!window.confirm("Are you sure you want to delete this chat?")) return;
    try {
      await axios.delete(`${API_URL}/conversation`, {
        data: {
          user_id: userId,
          conversation_id: conversations[index].conversation_id,
        },
      });
      setConversations((prev) => prev.filter((_, i) => i !== index));
      setChats((prev) => prev.filter((_, i) => i !== index));
      setSelectedChatIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } catch (err) {
      console.error("Delete chat error:", err);
    }
  };

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="chat-app">
      <div className="chat-body">

        <div
          className="sidebar-wrapper"
          style={
            isMobile
              ? {}
              : { width: sidebarWidth, minWidth: MIN_SIDEBAR, maxWidth: MAX_SIDEBAR }
          }
        >
          <ChatSidebar
            conversations={conversations}
            selectChat={setSelectedChatIndex}
            startNewConversation={startNewConversation}
            deleteConversation={deleteConversation}
            selectedChatIndex={selectedChatIndex}
            logout={logout}
            user={user}
          />

          {!isMobile && (
            <div
              className="sidebar-resize-handle"
              onMouseDown={onMouseDown}
              title="Drag to resize"
            />
          )}
        </div>

        {/* Right panel: FileUpload on top, ChatWindow below */}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, gap: "8px", padding: "8px 8px 0 0" }}>

          {/* ── FILE UPLOAD — Gemini analyses, answer goes into chat ── */}
          <FileUpload
            onUserMessage={addUserMsg}
            onBotMessage={addBotMsg}
            theme={theme}
            maxFiles={5}
            maxMB={10}
          />

          {/* ── CHAT WINDOW — unchanged ── */}
          <ChatWindow
            chat={chats[selectedChatIndex] || []}
            onSendMessage={handleSendMessage}
            username={username}
            theme={theme}
            toggleTheme={toggleTheme}
          />

        </div>

      </div>
    </div>
  );
};

export default ChatApp;