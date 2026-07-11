// src/theme/roleThemes.js

/* ============================================================
   BASE THEME (fallback + shared values)
   ============================================================ */
const BASE_THEME = {
  accent: "#38f3bb",
  accentDim: "rgba(56, 243, 187, 0.12)",
  accentGlow: "rgba(56, 243, 187, 0.25)",
  bubbleUser: "linear-gradient(135deg, #7059ff, #5040cc)",
  bgSelected: "rgba(56, 243, 187, 0.08)",
  borderAccent: "rgba(56, 243, 187, 0.4)",
  badgeGradient: "linear-gradient(135deg, #38f3bb, #1ed8a4)",
  label: "User 👤",
};

/* ============================================================
   ROLE THEMES
   ============================================================ */
export const ROLE_THEMES = {
  hacker: {
    ...BASE_THEME,
    accent: "#575253",
    accentDim: "rgba(255, 95, 126, 0.12)",
    accentGlow: "rgba(44, 156, 182, 0.25)",
    bubbleUser: "linear-gradient(135deg, #566e1a, #0e1762)",
    bgSelected: "rgba(255, 95, 126, 0.08)",
    borderAccent: "rgba(255, 95, 126, 0.4)",
    badgeGradient: "linear-gradient(135deg, #ff5f7e, #cc3a52)",
    label: "Hacker 😈",
  },

  user: {
    ...BASE_THEME,
    label: "User 👤",
  },

  hr: {
    ...BASE_THEME,
    accent: "#38b2f3",
    accentDim: "rgba(56, 178, 243, 0.12)",
    accentGlow: "rgba(56, 178, 243, 0.25)",
    bubbleUser: "linear-gradient(135deg, #38b2f3, #1a7abf)",
    bgSelected: "rgba(56, 178, 243, 0.08)",
    borderAccent: "rgba(56, 178, 243, 0.4)",
    badgeGradient: "linear-gradient(135deg, #38b2f3, #1a7abf)",
    label: "HR 👔",
  },

  manager: {
    ...BASE_THEME,
    accent: "#a78bfa",
    accentDim: "rgba(167, 139, 250, 0.12)",
    accentGlow: "rgba(167, 139, 250, 0.25)",
    bubbleUser: "linear-gradient(135deg, #8bd5fa, #ed963a)",
    bgSelected: "rgba(167, 139, 250, 0.08)",
    borderAccent: "rgba(167, 139, 250, 0.4)",
    badgeGradient: "linear-gradient(135deg, #a78bfa, #7c3aed)",
    label: "Manager 🧠",
  },
};

/* ============================================================
   GET THEME (safe + flexible)                                  
   ============================================================ */
export const getTheme = (role = "user") => {
  const key = role?.toLowerCase()?.trim();
  return ROLE_THEMES[key] || BASE_THEME;
};

/* ============================================================
   APPLY THEME TO CSS VARIABLES (🔥 MAGIC)
   ============================================================ */
export const applyTheme = (theme) => {
  const root = document.documentElement;

  Object.entries(theme).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });
};

/* ============================================================
   INIT THEME (optional helper)                                 
   ============================================================ */
export const initTheme = (role) => {
  const theme = getTheme(role);
  applyTheme(theme);
  return theme;
};

