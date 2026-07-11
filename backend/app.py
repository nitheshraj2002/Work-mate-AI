from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import json
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timezone
import os
import pandas as pd
import base64
import tempfile

from gemini_ai import ask_gemini

# ---------------- UPDATED IMPORTS ----------------
from db_queries import (
    get_hr_data,
    get_developer_data,
    get_manager_data,
    format_hr_data,
    format_developer_data,
    format_manager_data,
    get_all_employee_profiles, get_own_profile, format_employee_profiles,
    get_all_leave_requests, get_own_leave_requests, format_leave_requests, apply_leave,
    get_all_payroll, format_payroll,
    get_all_tasks, get_tasks_for_employee, format_tasks, save_task,
    get_all_projects, format_projects,
    get_all_attendance, get_own_attendance, format_attendance,
    get_announcements, format_announcements,
    check_csv_access
)

# ---------------- FLASK APP ----------------
app = Flask(__name__)
CORS(app)

# ---------------- UPLOAD FOLDER ----------------
UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# ---------------- MYSQL CONFIG ----------------
db_config = {
    "user": "root",
    "password": "Nithesh2002@222Raj",
    "host": "localhost",
    "port": 2002,
    "database": "chattybot"
}

# ---------------- RASA CONFIG ----------------
RASA_SERVER_URL = "http://localhost:5005/webhooks/rest/webhook"

# ---------------- DB CONNECTION ----------------
def get_db():
    return mysql.connector.connect(**db_config)


# ════════════════════════════════════════════════════════════════
# /upload_file — paperclip button in ChatWindow
# File → Flask → ask_gemini() → reply
# ════════════════════════════════════════════════════════════════
@app.route("/upload_file", methods=["POST"])
def upload_file():
    try:
        question  = (request.form.get("question") or "").strip()
        role      = (request.form.get("role") or "user").lower()
        username  = (request.form.get("username") or "").strip()
        file      = request.files.get("file")

        if not file or file.filename == "":
            return jsonify({"error": "No file provided"}), 400

        # ── Force detect file type by EXTENSION (reliable) ────
        filename  = file.filename.lower()
        mime_type = file.content_type or ""

        if filename.endswith(".txt"):
            mime_type = "text/plain"
        elif filename.endswith(".json"):
            mime_type = "application/json"
        elif filename.endswith(".csv"):
            mime_type = "text/csv"
        elif filename.endswith(".xlsx"):
            mime_type = "spreadsheet"
        elif filename.endswith(".xls"):
            mime_type = "spreadsheet"
        elif filename.endswith(".docx"):
            mime_type = "docx"
        elif filename.endswith(".pdf"):
            mime_type = "application/pdf"
        elif filename.endswith(".png"):
            mime_type = "image/png"
        elif filename.endswith(".jpg") or filename.endswith(".jpeg"):
            mime_type = "image/jpeg"
        elif filename.endswith(".gif"):
            mime_type = "image/gif"
        elif filename.endswith(".webp"):
            mime_type = "image/webp"

        print(f"File received: {filename} | mime: {mime_type}")

        db_data        = ""
        final_question = ""

        # ── TXT ────────────────────────────────────────────────
        if mime_type == "text/plain":
            content = file.read().decode("utf-8", errors="ignore")
            db_data = f"=== FILE: {file.filename} ===\n{content}\n=== END ==="
            final_question = question if question else (
                "Analyse this text file and give a detailed helpful response. "
                "Summarise the content clearly using markdown formatting."
            )

        # ── JSON ───────────────────────────────────────────────
        elif mime_type == "application/json":
            content = file.read().decode("utf-8", errors="ignore")
            db_data = f"=== FILE: {file.filename} ===\n{content}\n=== END ==="
            final_question = question if question else (
                "Analyse this JSON data and give a detailed helpful response. "
                "Explain the structure and key values clearly using markdown."
            )

        # ── CSV ────────────────────────────────────────────────
        elif mime_type == "text/csv":
            df           = pd.read_csv(file)
            df_preview   = df.head(100)  # limit rows for speed
            db_data      = f"=== FILE: {file.filename} ===\n{df_preview.to_string(index=False)}\n=== END ==="
            final_question = question if question else (
                "Analyse this CSV data and give a detailed helpful response. "
                "Describe key stats, patterns and insights. Use markdown formatting."
            )

        # ── XLSX ───────────────────────────────────────────────
        elif mime_type == "spreadsheet":
            df           = pd.read_excel(file)
            df_preview   = df.head(100)  # limit rows for speed
            db_data      = f"=== FILE: {file.filename} ===\n{df_preview.to_string(index=False)}\n=== END ==="
            final_question = question if question else (
                "Analyse this Excel data and give a detailed helpful response. "
                "Describe key stats, patterns and insights. Use markdown formatting."
            )

        # ── DOCX ───────────────────────────────────────────────
        elif mime_type == "docx":
            import io
            try:
                from docx import Document  # type: ignore
                doc     = Document(io.BytesIO(file.read()))
                content = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
                db_data = f"=== FILE: {file.filename} ===\n{content}\n=== END ==="
            except ImportError:
                return jsonify({"error": "python-docx not installed on server"}), 500
            final_question = question if question else (
                "Analyse this Word document and give a detailed helpful response. "
                "Summarise the content clearly using markdown formatting."
            )

        # ── Images & PDF — not supported by gemini-3-flash ────
        elif mime_type.startswith("image/") or mime_type == "application/pdf":
            return jsonify({
                "reply": (
                    "⚠️ **Image and PDF files** are not supported with the current AI model (`gemini-3-flash-preview`).\n\n"
                    "**Supported file types:**\n"
                    "- 📝 TXT — text files\n"
                    "- 🗂️ JSON — JSON data files\n"
                    "- 📊 CSV — comma separated data\n"
                    "- 📊 XLSX — Excel spreadsheets\n"
                    "- 📃 DOCX — Word documents\n\n"
                    "Please upload one of the supported file types."
                )
            })

        else:
            return jsonify({
                "reply": (
                    f"⚠️ **Unsupported file type:** `{file.filename}`\n\n"
                    "**Supported file types:**\n"
                    "- 📝 TXT\n- 🗂️ JSON\n- 📊 CSV\n- 📊 XLSX\n- 📃 DOCX"
                )
            })

        # ── Call ask_gemini ────────────────────────────────────
        print(f"Sending to Gemini | question: {final_question[:80]}")
        print(f"db_data preview: {db_data[:200]}")

        reply = ask_gemini(
            question     = final_question,
            role         = role,
            db_data      = db_data,
            chat_history = ""
        )

        return jsonify({"reply": reply})

    except Exception as e:
        print("upload_file error:", e)
        return jsonify({"error": str(e)}), 500


# ---------------- UPLOAD CSV/XLSX (Hacker only) ----------------
@app.route("/upload_csv", methods=["POST"])
def upload_csv():
    username = request.form.get("username", "").strip()
    role     = request.form.get("role", "").lower()

    if role != "hacker" or not check_csv_access(username):
        return jsonify({"error": "Access denied. Only authorized Hacker users can upload CSV."}), 403

    file = request.files.get("file")
    if not file or not (file.filename.endswith(".csv") or file.filename.endswith(".xlsx")):
        return jsonify({"error": "Please upload a valid .csv or .xlsx file"}), 400

    ext      = "xlsx" if file.filename.endswith(".xlsx") else "csv"
    filename = f"{username.lower()}_data.{ext}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    print(f"File uploaded by {username}: {filepath}")
    return jsonify({"message": "File uploaded successfully!", "filename": filename})


# ---------------- GEMINI CHAT ----------------
@app.route("/ai_chat", methods=["POST"])
def ai_chat():
    data            = request.get_json(force=True) or {}
    message         = (data.get("message") or "").strip()
    role            = (data.get("role") or "").lower()
    user_id         = data.get("user_id")
    username        = (data.get("username") or "").strip()
    conversation_id = data.get("conversation_id")

    if not message:
        return jsonify({"error": "message is required"}), 400
    if not role:
        return jsonify({"error": "role is required"}), 400

    # ---------------- CREATE CONVERSATION IF MISSING ----------------
    if not conversation_id:
        conversation_id = str(datetime.now(timezone.utc).timestamp())
        try:
            conn   = get_db()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO conversations (user_id, conversation_id, timestamp) VALUES (%s, %s, %s)",
                (user_id, conversation_id, datetime.now(timezone.utc))
            )
            conn.commit()
            print("Created new conversation:", conversation_id)
        except Exception as e:
            print("Failed to create conversation:", e)
            return jsonify({"error": "Failed to create conversation"}), 500
        finally:
            if cursor: cursor.close()
            if conn:   conn.close()

    print("User Message:", message)
    print("User Role:", role)
    print("Username:", username)
    print("Conversation ID:", conversation_id)

    # ---------------- GET DB DATA ----------------
    db_data = ""
    try:
        announcements = format_announcements(get_announcements())

        if role == "hr":
            db_data = "\n\n".join([
                "=== Employee Profiles ===",
                format_employee_profiles(get_all_employee_profiles()),
                "=== Leave Requests ===",
                format_leave_requests(get_all_leave_requests()),
                "=== Payroll ===",
                format_payroll(get_all_payroll()),
                "=== HR Data ===",
                format_hr_data(get_hr_data()),
                "=== Developer Data ===",
                format_developer_data(get_developer_data()),
                "=== Announcements ===",
                announcements
            ])

        elif role == "manager":
            employees = get_all_employee_profiles()
            emp_list  = "\n".join(
                f"- {r['full_name']} (username: {r['username']})"
                for r in employees
            ) or "No employees."

            db_data = "\n\n".join([
                "=== Employee Usernames (use these for task assignment) ===",
                emp_list,
                "=== Manager Data ===",
                format_manager_data(get_manager_data()),
                "=== All Tasks ===",
                format_tasks(get_all_tasks()),
                "=== Projects ===",
                format_projects(get_all_projects()),
                "=== Attendance ===",
                format_attendance(get_all_attendance()),
                "=== Announcements ===",
                announcements
            ])

        elif role == "developer":
            db_data = "\n\n".join([
                "=== Your Profile ===",
                format_employee_profiles(get_own_profile(username)),
                "=== Your Tasks ===",
                format_tasks(get_tasks_for_employee(username)),
                "=== Your Attendance ===",
                format_attendance(get_own_attendance(username)),
                "=== Your Leave Requests ===",
                format_leave_requests(get_own_leave_requests(username)),
                "=== Announcements ===",
                announcements
            ])

        elif role == "hacker":
            print("DEBUG >>> username:", username)
            print("DEBUG >>> role:", role)
            print("DEBUG >>> access:", check_csv_access(username))

            if not check_csv_access(username):
                db_data = "You do not have CSV access."
            else:
                csv_path  = os.path.join(UPLOAD_FOLDER, f"{username.lower()}_data.csv")
                xlsx_path = os.path.join(UPLOAD_FOLDER, f"{username.lower()}_data.xlsx")

                if os.path.exists(xlsx_path):
                    file_path = xlsx_path
                elif os.path.exists(csv_path):
                    file_path = csv_path
                else:
                    file_path = None

                if file_path:
                    try:
                        if file_path.endswith(".xlsx"):
                            df = pd.read_excel(file_path)
                        else:
                            df = pd.read_csv(file_path)
                        csv_text = df.to_string(index=False)
                        print(f"File loaded for: {username}")
                    except Exception as e:
                        print("File read error:", e)
                        csv_text = "Error reading file."
                else:
                    csv_text = "No file uploaded yet. Please upload a CSV or Excel file first."

                db_data = "\n\n".join([
                    "=== Uploaded File Data ===",
                    csv_text
                ])

        else:
            db_data = "No role data available."

    except Exception as e:
        print("DB Fetch Error:", e)
        db_data = "Error fetching role data."

    # ---------------- GET CHAT HISTORY ----------------
    chat_history_text = ""
    try:
        history = get_chat_history(conversation_id)
        for item in history[-6:]:
            if item.get("user_message"):
                chat_history_text += f"User: {item['user_message']}\n"
            if item.get("bot_response"):
                chat_history_text += f"Bot: {item['bot_response']}\n"
        print("Chat history loaded:", len(history), "messages")
    except Exception as e:
        print("History fetch error:", e)
        chat_history_text = ""

    print("DB DATA SENT TO GEMINI:\n", db_data)

    # ---------------- CALL GEMINI ----------------
    try:
        reply_raw = ask_gemini(message, role, db_data, chat_history_text)
    except Exception as e:
        print("Gemini Error:", e)
        return f"Gemini AI unavailable: {str(e)}"  # ← change this line
        reply_raw = f"Gemini AI unavailable: {str(e)}"  # ← CORRECT
    # ---------------- DETECT MANAGER TASK ASSIGNMENT ----------------
    reply = reply_raw
    if role == "manager":
        try:
            parsed = json.loads(reply_raw)
            if parsed.get("action") == "assign_task":
                success = save_task(
                    assigned_by = username or f"user_{user_id}",
                    assigned_to = parsed.get("assigned_to", "").lower(),
                    task_desc   = parsed.get("task", ""),
                    priority    = parsed.get("priority", "medium"),
                    deadline    = parsed.get("deadline")
                )
                reply = (
                    f"Task assigned to {parsed.get('assigned_to')}: \"{parsed.get('task')}\""
                    if success else "Failed to save task to database."
                )
        except (json.JSONDecodeError, TypeError):
            pass
                                                                                                                                                                                                                        
    # ---------------- DETECT DEVELOPER LEAVE APPLICATION ----------------
    if role == "developer":
        try:
            parsed = json.loads(reply_raw)
            if parsed.get("action") == "apply_leave":
                success = apply_leave(
                    username   = username,
                    leave_type = parsed.get("leave_type", "casual"),
                    from_date  = parsed.get("from_date"),
                    to_date    = parsed.get("to_date"),
                    reason     = parsed.get("reason", "")
                )
                reply = (
                    "Your leave request has been submitted!"
                    if success else "Failed to submit leave."
                )
        except (json.JSONDecodeError, TypeError):
            pass

    # ---------------- SAVE MESSAGE ----------------
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (conversation_id, user_message, bot_response, timestamp) VALUES (%s, %s, %s, %s)",
            (conversation_id, message, reply, datetime.now(timezone.utc))
        )
        conn.commit()
        print("Message saved to DB successfully.")
    except Exception as e:
        print("Failed to save chat to DB:", e)
        return jsonify({"error": "Failed to save message"}), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

    return jsonify({"reply": reply, "conversation_id": conversation_id})


# ---------------- REGISTER ----------------
@app.route("/register", methods=["POST"])
def register():
    data     = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()
    role     = data.get("role", "user")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE username=%s", (username,))
        if cursor.fetchone():
            return jsonify({"error": "Username already exists"}), 400
        cursor.execute(
            "INSERT INTO users (username, password, role) VALUES (%s, %s, %s)",
            (username, password, role)
        )
        conn.commit()
        return jsonify({"message": "User registered successfully"}), 201
    except Error as e:
        print("Register Error:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ---------------- LOGIN ----------------
@app.route("/login", methods=["POST"])
def login():
    data     = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "").strip()

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, username, password, role FROM users WHERE username=%s",
            (username,)
        )
        user = cursor.fetchone()
        if not user or user["password"] != password:
            return jsonify({"error": "Invalid username or password"}), 401
        return jsonify({
            "user_id":  user["id"],
            "username": user["username"],
            "role":     user["role"]
        }), 200
    except Error as e:
        print("Login Error:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ---------------- SAVE CHAT ----------------
def save_chat_to_db(conversation_id, user_message, bot_response):
    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO messages (conversation_id, user_message, bot_response, timestamp) VALUES (%s, %s, %s, %s)",
            (conversation_id, user_message, bot_response, datetime.now(timezone.utc))
        )
        conn.commit()
    except Error as e:
        print("DB Save Error:", e)
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ---------------- FETCH HISTORY ----------------
def get_chat_history(conversation_id):
    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT user_message, bot_response FROM messages WHERE conversation_id=%s ORDER BY timestamp ASC",
            (conversation_id,)
        )
        return cursor.fetchall()
    except Error as e:
        print("DB Fetch Error:", e)
        return []
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ---------------- RASA CHAT ----------------
@app.route("/chat", methods=["POST"])
def chat():
    data            = request.json
    user_message    = data.get("message", "").strip()
    user_id         = data.get("user_id")
    conversation_id = data.get("conversation_id")
    role            = data.get("role", "")

    if not user_message or not user_id or not conversation_id:
        return jsonify({"error": "Missing required fields"}), 400

    bot_text = "Sorry, I didn't understand."
    try:
        response = requests.post(
            RASA_SERVER_URL,
            json={
                "sender":   str(user_id),
                "message":  user_message,
                "metadata": {"role": role}
            },
            timeout=5
        )
        if response.status_code == 200:
            rasa_data = response.json()
            if rasa_data and isinstance(rasa_data, list):
                bot_text = rasa_data[0].get("text", bot_text)
    except Exception as e:
        print("Rasa Error:", e)
        bot_text = "Rasa server not available"

    save_chat_to_db(conversation_id, user_message, bot_text)
    return jsonify({"reply": bot_text})


# ---------------- CHAT HISTORY ----------------
@app.route("/history", methods=["GET"])
def history():
    conversation_id = request.args.get("conversation_id")
    if not conversation_id:
        return jsonify({"error": "conversation_id required"}), 400
    return jsonify(get_chat_history(conversation_id))


# ---------------- NEW CONVERSATION ----------------
@app.route("/new_conversation", methods=["POST"])
def new_conversation():
    data    = request.json
    user_id = data.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    conversation_id = str(datetime.now(timezone.utc).timestamp())
    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (user_id, conversation_id, timestamp) VALUES (%s, %s, %s)",
            (user_id, conversation_id, datetime.now(timezone.utc))
        )
        conn.commit()
    except Error as e:
        print("Conversation Error:", e)
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

    return jsonify({"conversation_id": conversation_id})


# ---------------- GET CONVERSATIONS ----------------
@app.route("/conversations", methods=["GET"])
def get_conversations():
    user_id = request.args.get("user_id")
    if not user_id:
        return jsonify({"error": "user_id required"}), 400

    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT conversation_id FROM conversations WHERE user_id=%s",
            (user_id,)
        )
        return jsonify(cursor.fetchall())
    except Error as e:
        print("Fetch Error:", e)
        return jsonify([])
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()


# ---------------- DELETE CONVERSATION ----------------
@app.route("/conversation", methods=["DELETE"])
def delete_conversation():
    data            = request.json
    conversation_id = data.get("conversation_id")
    if not conversation_id:
        return jsonify({"error": "conversation_id required"}), 400

    conn = cursor = None
    try:
        conn   = get_db()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM messages WHERE conversation_id=%s", (conversation_id,))
        cursor.execute("DELETE FROM conversations WHERE conversation_id=%s", (conversation_id,))
        conn.commit()
    except Error as e:
        print("Delete Error:", e)
    finally:
        if cursor: cursor.close()
        if conn:   conn.close()

    return jsonify({"message": "Conversation deleted"})


# ---------------- RUN SERVER ----------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)