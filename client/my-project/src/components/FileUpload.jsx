// src/components/FileUpload.jsx
// ──────────────────────────────────────────────────────────────
// Upload files → Gemini analyses → answer appears in chat
// NO changes needed in ChatWindow.jsx
// ──────────────────────────────────────────────────────────────

import React, { useRef, useState, useCallback } from "react";
import "./FileUpload.css";

// ── CONFIG ─────────────────────────────────────────────────────
// ⚠️ Move to .env in production: import.meta.env.VITE_GEMINI_KEY
const GEMINI_API_KEY = "AIzaSyBfB3JKVGI0tz0bvrqScgxvXt2seaqu1Ew";
const GEMINI_MODEL   = "gemini-2.0-flash";
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

// ── Accepted MIME types ─────────────────────────────────────────
const ACCEPTED = {
  "application/pdf":   { label: "PDF",  icon: "📄" },
  "image/png":         { label: "PNG",  icon: "🖼️" },
  "image/jpeg":        { label: "JPG",  icon: "🖼️" },
  "image/gif":         { label: "GIF",  icon: "🎞️" },
  "image/webp":        { label: "WebP", icon: "🖼️" },
  "text/csv":          { label: "CSV",  icon: "📊" },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                       { label: "XLSX", icon: "📊" },
  "application/vnd.ms-excel":
                       { label: "XLS",  icon: "📊" },
  "text/plain":        { label: "TXT",  icon: "📝" },
  "application/json":  { label: "JSON", icon: "🗂️" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                       { label: "DOCX", icon: "📃" },
};
const ACCEPT_STRING = Object.keys(ACCEPTED).join(",");

// ── Helpers ─────────────────────────────────────────────────────
const formatSize = (b) =>
  b < 1024 ? `${b} B` : b < 1024 ** 2 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 ** 2).toFixed(1)} MB`;

const fileInfo = (file) => ({
  name:    file.name,
  size:    formatSize(file.size),
  icon:    ACCEPTED[file.type]?.icon ?? "📎",
  label:   ACCEPTED[file.type]?.label ?? "FILE",
  raw:     file,
  id:      `${file.name}-${file.lastModified}`,
  preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
});

// File → base64 (no data-url prefix)
const toBase64 = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

// Text files → plain string
const toText = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });

// Build a Gemini part from a File
const buildPart = async (file) => {
  const isTextFile =
    file.type === "text/csv" ||
    file.type === "text/plain" ||
    file.type === "application/json";

  if (isTextFile) {
    const text = await toText(file);
    return { text: `=== FILE: ${file.name} ===\n${text}\n=== END ===` };
  }
  // Images, PDFs, DOCX, XLSX → inline base64
  const data = await toBase64(file);
  return { inline_data: { mime_type: file.type, data } };
};

// ── Call Gemini ─────────────────────────────────────────────────
const askGemini = async (rawFiles, question) => {
  const fileParts = await Promise.all(rawFiles.map(buildPart));

  const prompt =
    question?.trim() ||
    "Analyse the uploaded file(s) and give a detailed, helpful response. " +
    "If it contains data (CSV/XLSX/JSON), describe key stats and patterns. " +
    "If it is an image, describe what you see in detail. " +
    "If it is a document (PDF/DOCX/TXT), summarise the content clearly. " +
    "Be concise, structured, and use markdown formatting.";

  const body = {
    contents: [{ parts: [...fileParts, { text: prompt }] }],
    generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
  };

  const res = await fetch(GEMINI_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  const json = await res.json();
  return (
    json?.candidates?.[0]?.content?.parts?.[0]?.text ??
    "Gemini returned an empty response."
  );
};

// ── FileUpload Component ────────────────────────────────────────
/**
 * Props:
 *   onUserMessage(text)  → push a user bubble into chat
 *   onBotMessage(text)   → push a bot bubble into chat
 *   theme?  "dark" | "light"    (default "dark")
 *   maxFiles? number            (default 5)
 *   maxMB?   number             (default 10)
 */
const FileUpload = ({
  onUserMessage,
  onBotMessage,
  theme    = "dark",
  maxFiles = 5,
  maxMB    = 10,
}) => {
  const inputRef = useRef(null);
  const [dragging,  setDragging]  = useState(false);
  const [files,     setFiles]     = useState([]);
  const [errors,    setErrors]    = useState([]);
  const [expanded,  setExpanded]  = useState(false);
  const [question,  setQuestion]  = useState("");
  const [loading,   setLoading]   = useState(false);

  // ── Validation ────────────────────────────────────────────
  const validate = (incoming) => {
    const errs = [], valid = [];
    for (const f of incoming) {
      if (!ACCEPTED[f.type]) { errs.push(`"${f.name}" — unsupported type`); continue; }
      if (f.size > maxMB * 1024 * 1024) { errs.push(`"${f.name}" — exceeds ${maxMB} MB`); continue; }
      valid.push(f);
    }
    return { valid, errs };
  };

  const addFiles = useCallback((incoming) => {
    const { valid, errs } = validate(incoming);
    setErrors(errs);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.id));
      const next = valid.map(fileInfo).filter((f) => !existing.has(f.id));
      return [...prev, ...next].slice(0, maxFiles);
    });
    if (valid.length > 0) setExpanded(true);
  }, [maxFiles, maxMB]);

  // ── Drag & drop ───────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const onDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const onDrop      = (e) => { e.preventDefault(); setDragging(false); addFiles([...e.dataTransfer.files]); };
  const onFileInput = (e) => { addFiles([...e.target.files]); e.target.value = ""; };

  const removeFile = (id) => setFiles((prev) => {
    const next = prev.filter((f) => f.id !== id);
    if (next.length === 0) setExpanded(false);
    return next;
  });

  const clearAll = () => { setFiles([]); setErrors([]); setExpanded(false); setQuestion(""); };

  // ── Main send handler ─────────────────────────────────────
  const handleSend = async () => {
    if (files.length === 0 || loading) return;

    // Build user bubble text
    const nameList = files.map((f) => `📎 ${f.name}`).join("  ");
    const userText = question.trim() ? `${nameList}\n💬 ${question.trim()}` : nameList;
    onUserMessage?.(userText);

    // Snapshot & reset
    const rawFiles = files.map((f) => f.raw);
    const q = question;
    clearAll();

    // Call Gemini
    setLoading(true);
    try {
      const answer = await askGemini(rawFiles, q);
      onBotMessage?.(answer);
    } catch (err) {
      onBotMessage?.(`⚠️ Gemini error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className={`fu-root fu-${theme}`}>

      {/* Loading indicator */}
      {loading && (
        <div className="fu-loading-bar">
          <span className="fu-loading-dot" />
          <span className="fu-loading-dot" style={{ animationDelay: "0.15s" }} />
          <span className="fu-loading-dot" style={{ animationDelay: "0.30s" }} />
          <span className="fu-loading-text">Gemini is analysing your file…</span>
        </div>
      )}

      {/* ── COLLAPSED: big drop zone ─────────────────────── */}
      {!expanded && !loading && (
        <div
          className={`fu-dropzone ${dragging ? "fu-drag-over" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          aria-label="Upload files"
        >
          <div className="fu-dz-inner">
            <div className="fu-dz-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <p className="fu-dz-title">{dragging ? "Drop files here" : "Upload Files"}</p>
            <p className="fu-dz-sub">PDF · Images · CSV · XLSX · DOCX · TXT · JSON</p>
            <p className="fu-dz-sub fu-hint">
              Drag & drop or click · max {maxMB} MB · up to {maxFiles} files
            </p>
          </div>
        </div>
      )}

      {/* ── EXPANDED: file panel ─────────────────────────── */}
      {expanded && !loading && (
        <div className="fu-panel">

          {/* Header row */}
          <div className="fu-panel-header">
            <span className="fu-panel-title">
              📎 {files.length} file{files.length !== 1 ? "s" : ""} ready
            </span>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="fu-btn fu-btn-ghost" onClick={() => inputRef.current?.click()}>+ Add</button>
              <button className="fu-btn fu-btn-ghost" onClick={clearAll}>✕ Clear</button>
            </div>
          </div>

          {/* File list */}
          <div className="fu-file-list">
            {files.map((f) => (
              <div key={f.id} className="fu-file-row">
                {f.preview
                  ? <img src={f.preview} alt={f.name} className="fu-thumb" />
                  : <span className="fu-file-icon">{f.icon}</span>
                }
                <div className="fu-file-meta">
                  <span className="fu-file-name" title={f.name}>{f.name}</span>
                  <span className="fu-file-size">{f.label} · {f.size}</span>
                </div>
                <button className="fu-remove-btn" onClick={() => removeFile(f.id)}>✕</button>
              </div>
            ))}
          </div>

          {/* Mini drop zone */}
          <div
            className={`fu-dropzone fu-dropzone-sm ${dragging ? "fu-drag-over" : ""}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
          >
            <span style={{ fontSize: "12px", opacity: 0.6 }}>
              {dragging ? "Drop here" : "Drop more files or click"}
            </span>
          </div>

          {/* Optional question */}
          <div className="fu-question-row">
            <svg className="fu-q-icon" width="14" height="14" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <input
              className="fu-question-input"
              type="text"
              placeholder="Ask something about the file(s)… (optional)"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
          </div>

          {/* Validation errors */}
          {errors.length > 0 && (
            <div className="fu-errors">
              {errors.map((e, i) => <p key={i} className="fu-error-msg">⚠️ {e}</p>)}
            </div>
          )}

          {/* Analyse button */}
          <button
            className="fu-btn fu-btn-send"
            onClick={handleSend}
            disabled={files.length === 0}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Analyse with Gemini AI
          </button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        style={{ display: "none" }}
        onChange={onFileInput}
      />
    </div>
  );
};

export default FileUpload;