import os
from datetime import datetime
import mysql.connector
from mysql.connector import Error

def get_db_connection():
    try:
        return mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "Nithesh2002@Raj"),
            database=os.getenv("DB_NAME", "chattybot"),
            port=int(os.getenv("DB_PORT", 2002))
        )
    except Error as e:
        print("DB connection error:", e)
        return None

def get_table_data(table_name, where_clause=None, params=None):
    conn = cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            return []
        cursor = conn.cursor(dictionary=True)
        sql = f"SELECT * FROM {table_name}"
        if where_clause:
            sql += f" WHERE {where_clause}"
        cursor.execute(sql, params or ())
        return cursor.fetchall()
    except Error as e:
        print(f"DB Error ({table_name}):", e)
        return []
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ── existing ──────────────────────────────────
def get_hr_data(): return get_table_data("hr_data")
def get_developer_data(): return get_table_data("developer_data")
def get_manager_data(): return get_table_data("manager_data")

# ── employee profiles ─────────────────────────
def get_all_employee_profiles():
    return get_table_data("employee_profiles")

def get_own_profile(username):
    return get_table_data("employee_profiles", "username=%s", (username,))

# ── leave requests ────────────────────────────
def get_all_leave_requests():
    return get_table_data("leave_requests")

def get_own_leave_requests(username):
    return get_table_data("leave_requests", "username=%s", (username,))

def apply_leave(username, leave_type, from_date, to_date, reason):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO leave_requests 
               (username, leave_type, from_date, to_date, reason, status)
               VALUES (%s,%s,%s,%s,%s,'pending')""",
            (username, leave_type, from_date, to_date, reason)
        )
        conn.commit()
        return True
    except Error as e:
        print("Apply leave error:", e)
        return False
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ── payroll (HR only) ─────────────────────────
def get_all_payroll():
    return get_table_data("payroll")

def get_own_payroll(username):
    return get_table_data("payroll", "username=%s", (username,))

# ── tasks ─────────────────────────────────────
def get_all_tasks():
    return get_table_data("tasks")

def get_tasks_for_employee(username):
    return get_table_data("tasks", "assigned_to=%s", (username,))

def save_task(assigned_by, assigned_to, task_desc, priority="medium", deadline=None):
    conn = cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT INTO tasks 
               (assigned_by, assigned_to, task_description, priority, status, deadline)
               VALUES (%s,%s,%s,%s,'pending',%s)""",
            (assigned_by, assigned_to, task_desc, priority, deadline)
        )
        conn.commit()
        return True
    except Error as e:
        print("Save task error:", e)
        return False
    finally:
        if cursor: cursor.close()
        if conn: conn.close()

# ── project tracker ───────────────────────────
def get_all_projects():
    return get_table_data("project_tracker")

# ── attendance ────────────────────────────────
def get_all_attendance():
    return get_table_data("attendance")

def get_own_attendance(username):
    return get_table_data("attendance", "username=%s", (username,))

# ── announcements (all roles) ─────────────────
def get_announcements():
    return get_table_data("announcements")

# ══ FORMAT FUNCTIONS ══════════════════════════

def format_hr_data(rows):
    if not rows: return "No HR data."
    return "\n\n".join(
        f"{r['name']} (ID:{r['id']}) | {r['position']} | Leave:{r['leave_balance']} | Salary:${r['salary']:.2f}"
        for r in rows)

def format_developer_data(rows):
    if not rows: return "No developer data."
    return "\n\n".join(
        f"{r['name']} (ID:{r['id']}) | {r['position']} | Exp:{r['experience']}yrs | Salary:${r['salary']:.2f}"
        for r in rows)

def format_manager_data(rows):
    if not rows: return "No manager data."
    return "\n\n".join(
        f"{r['name']} (ID:{r['id']}) | Dept:{r['department']} | Team:{r['team_size']} | Salary:${r['salary']:.2f}"
        for r in rows)

def format_employee_profiles(rows):
    if not rows: return "No profiles found."
    return "\n\n".join(
        f"{r['full_name']} (@{r['username']})\n"
        f"  Dept: {r['department']} | Position: {r['position']}\n"
        f"  Phone: {r['phone']} | Email: {r['email']} | Joined: {r['join_date']}"
        for r in rows)

def format_leave_requests(rows):
    if not rows: return "No leave requests."
    return "\n\n".join(
        f"Leave #{r['id']} — {r['username']}\n"
        f"  Type: {r['leave_type']} | {r['from_date']} to {r['to_date']}\n"
        f"  Reason: {r['reason']} | Status: {r['status']}"
        for r in rows)

def format_payroll(rows):
    if not rows: return "No payroll data."
    return "\n\n".join(
        f"{r['username']} — {r['month']}\n"
        f"  Basic: ${r['basic_salary']:.2f} | Bonus: ${r['bonus']:.2f} | Deductions: ${r['deductions']:.2f}\n"
        f"  Net: ${r['net_salary']:.2f}"
        for r in rows)

def format_tasks(rows):
    if not rows: return "No tasks assigned."
    return "\n\n".join(
        f"Task #{r['id']} → {r['assigned_to']}\n"
        f"  {r['task_description']}\n"
        f"  Priority: {r['priority']} | Status: {r['status']} | Deadline: {r['deadline']}\n"
        f"  Assigned by: {r['assigned_by']}"
        for r in rows)

def format_projects(rows):
    if not rows: return "No projects."
    return "\n\n".join(
        f"Project: {r['project_name']} (Manager: {r['manager']})\n"
        f"  Status: {r['status']} | Deadline: {r['deadline']}\n"
        f"  Team: {r['team_members']}\n"
        f"  Desc: {r['description']}"
        for r in rows)

def format_attendance(rows):
    if not rows: return "No attendance records."
    return "\n\n".join(
        f"{r['username']} — {r['date']}: In {r['check_in']} / Out {r['check_out']} | {r['status']}"
        for r in rows)

def format_announcements(rows):
    if not rows: return "No announcements."
    return "\n\n".join(
        f"[{r['posted_on']}] {r['title']}\n  {r['message']}\n  — Posted by {r['posted_by']}"
        for r in rows)

# ── CSV access check ──────────────────────────
# FIXED: Simplified to always work correctly
# Checks csv_access=1 first, falls back to role='hacker' if column missing
def check_csv_access(username):
    conn = cursor = None
    try:
        conn = get_db_connection()
        if not conn:
            print(f"[check_csv_access] DB connection failed for: {username}")
            return False

        cursor = conn.cursor(dictionary=True)

        # ── Step 1: Check if csv_access column exists ──
        cursor.execute("SHOW COLUMNS FROM users LIKE 'csv_access'")
        column_exists = cursor.fetchone()

        if column_exists:
            # ── csv_access column EXISTS → check csv_access=1 OR role=hacker ──
            cursor.execute(
                """SELECT id FROM users 
                   WHERE LOWER(username) = %s 
                   AND (csv_access = 1 OR LOWER(role) = 'hacker')""",
                (username.lower(),)
            )
        else:
            # ── csv_access column MISSING → fallback: role=hacker only ──
            print(f"[check_csv_access] csv_access column not found, using role fallback for: {username}")
            cursor.execute(
                "SELECT id FROM users WHERE LOWER(username) = %s AND LOWER(role) = 'hacker'",
                (username.lower(),)
            )

        result = cursor.fetchone()
        granted = result is not None
        print(f"[check_csv_access] {username} → {'GRANTED ✅' if granted else 'DENIED ❌'}")
        return granted

    except Error as e:
        print(f"[check_csv_access] Error: {e}")
        return False
    finally:
        if cursor: cursor.close()
        if conn: conn.close()