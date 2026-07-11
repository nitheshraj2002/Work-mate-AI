from flask import Blueprint, request, jsonify
from mysql.connector import Error
from db import get_db

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.json
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    conn = None
    cursor = None

    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT id, username, password, role FROM users WHERE username=%s",
            (username,)
        )
        user = cursor.fetchone()

        if not user:
            return jsonify({"error": "User not found"}), 401

        # ✅ Plain text password check
        if password != user["password"]:
            return jsonify({"error": "Wrong password"}), 401

        return jsonify({
            "user_id": user["id"],
            "role": user["role"],
            "message": "Login successful"
        })

    except Error as e:
        print("Login Error:", e)
        return jsonify({"error": "Server error"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()