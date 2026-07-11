"""
╔══════════════════════════════════════════════════════════════════╗
║   EXTRAORDINARY RASA HR BOT — actions.py                        ║
║                                                                  ║
║   rasadb    → employees, employee_profiles, leave_requests,     ║
║               payroll, attendance, project_tracker,             ║
║               announcements                                     ║
║                                                                  ║
║   chattybot → tasks table only (shared with Gemini bot)         ║
║                                                                  ║
║   ROLES     : hr | manager | developer                          ║
╚══════════════════════════════════════════════════════════════════╝
"""

from typing import Any, Text, Dict, List
from rasa_sdk import Action, Tracker
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.events import SessionStarted, ActionExecuted, SlotSet, UserUtteranceReverted
from rasa_sdk.forms import FormValidationAction
from mysql.connector import pooling
from datetime import date, datetime
import os, re

# ══════════════════════════════════════════════════════════════════
# DATABASE 1 — rasadb (all HR tables except tasks)
# ══════════════════════════════════════════════════════════════════
RASA_DB_CONFIG = {
    "user":     os.environ.get("RASA_DB_USER",     "root"),
    "password": os.environ.get("RASA_DB_PASSWORD", "Nithesh2002@Raj"),
    "host":     os.environ.get("RASA_DB_HOST",     "localhost"),
    "port":     int(os.environ.get("RASA_DB_PORT", 2002)),
    "database": "rasaai_db",
}

# ══════════════════════════════════════════════════════════════════
# DATABASE 2 — chattybot (tasks table only, shared with Gemini)
# ══════════════════════════════════════════════════════════════════
CHATTY_DB_CONFIG = {
    "user":     os.environ.get("RASA_DB_USER",     "root"),
    "password": os.environ.get("RASA_DB_PASSWORD", "Nithesh2002@Raj"),
    "host":     os.environ.get("RASA_DB_HOST",     "localhost"),
    "port":     int(os.environ.get("RASA_DB_PORT", 2002)),
    "database": "chattybot",
}

try:
    rasa_pool = pooling.MySQLConnectionPool(
        pool_name="rasa_pool", pool_size=8, **RASA_DB_CONFIG
    )
    print("✅ rasadb pool ready")
except Exception as e:
    print(f"❌ rasadb pool error: {e}")
    rasa_pool = None

try:
    chatty_pool = pooling.MySQLConnectionPool(
        pool_name="chatty_pool", pool_size=3, **CHATTY_DB_CONFIG
    )
    print("✅ chattybot pool ready (tasks)")
except Exception as e:
    print(f"❌ chattybot pool error: {e}")
    chatty_pool = None


def run_query(sql: str, params: tuple = (), write: bool = False):
    """Query rasadb — all HR tables except tasks."""
    try:
        conn = rasa_pool.get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        if write:
            conn.commit()
            result = cur.rowcount
        else:
            result = cur.fetchall()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"rasadb ERROR: {e}")
        return [] if not write else 0


def run_task_query(sql: str, params: tuple = (), write: bool = False):
    """Query chattybot → tasks table only. Shared with Gemini."""
    try:
        conn = chatty_pool.get_connection()
        cur  = conn.cursor(dictionary=True)
        cur.execute(sql, params)
        if write:
            conn.commit()
            result = cur.rowcount
        else:
            result = cur.fetchall()
        cur.close()
        conn.close()
        return result
    except Exception as e:
        print(f"chattybot ERROR: {e}")
        return [] if not write else 0


# ══════════════════════════════════════════════════════════════════
# ROLE SYSTEM
# ══════════════════════════════════════════════════════════════════
ROLE_LEVEL = {"hr": 3, "manager": 2, "developer": 1}

def lvl(role: str) -> int:
    return ROLE_LEVEL.get(role, 0)

def deny(dispatcher):
    dispatcher.utter_message("⛔ You do not have permission to do this.")

# ══════════════════════════════════════════════════════════════════
# SECURITY — whitelisted fields only (prevents SQL injection)
# ══════════════════════════════════════════════════════════════════
ALLOWED_EMP_FIELDS = {
    "phone", "email", "salary", "role", "department",
    "experience", "location", "projects",
    "manager_name", "skills", "joining_date"
}

EMP_FIELD_MAP = {
    "phone":      "phone",
    "email":      "email",
    "salary":     "salary",
    "role":       "role",
    "department": "department",
    "experience": "experience",
    "location":   "location",
    "project":    "projects",
    "manager":    "manager_name",
    "skill":      "skills",
    "joining":    "joining_date",
}

INTENT_FIELD_MAP = {
    "ask_phone":        "phone",
    "ask_email":        "email",
    "ask_salary":       "salary",
    "ask_role":         "role",
    "ask_department":   "department",
    "ask_experience":   "experience",
    "ask_location":     "location",
    "ask_project":      "projects",
    "ask_manager":      "manager_name",
    "ask_skills":       "skills",
    "ask_joining_date": "joining_date",
}

# ══════════════════════════════════════════════════════════════════
# UTILITIES
# ══════════════════════════════════════════════════════════════════
def get_all_names() -> List[str]:
    rows = run_query("SELECT name FROM employees ORDER BY id")
    return [r["name"] for r in rows]


def extract_names(text: str) -> List[str]:
    """Word-boundary matching — avoids false substring matches."""
    matched = []
    for n in get_all_names():
        for part in n.lower().split():
            if re.search(r'\b' + re.escape(part) + r'\b', text.lower()):
                matched.append(n)
                break
    return matched


def extract_indices(text: str) -> List[int]:
    """Extract ranges like '1 to 4', '3rd', 'first 5'."""
    indices = []
    for s, e in re.findall(r'(\d+)\s*(?:to|-)\s*(\d+)', text):
        indices.extend(range(int(s) - 1, int(e)))
    for s in re.findall(r'\b(\d+)(?:st|nd|rd|th)?\b', text):
        v = int(s) - 1
        if v not in indices:
            indices.append(v)
    m = re.search(r'first\s*(\d+)', text)
    if m:
        indices = list(range(int(m.group(1))))
    return sorted(set(indices))


def fmt_rows(rows: list, fields: list = None) -> str:
    """Format DB rows as readable bullet list."""
    if not rows:
        return "No records found."
    keys = fields or list(rows[0].keys())
    lines = []
    for row in rows:
        parts = " | ".join(f"{k}: {row.get(k, 'N/A')}" for k in keys)
        lines.append(f"• {parts}")
    return "\n".join(lines)


def get_slot(tracker, name: str, default=""):
    return tracker.get_slot(name) or default


# ══════════════════════════════════════════════════════════════════
# 1. SESSION START
# ══════════════════════════════════════════════════════════════════
class ActionSessionStart(Action):
    def name(self): return "action_session_start"

    def run(self, dispatcher, tracker, domain):
        meta     = tracker.get_slot("session_started_metadata") or {}
        username = meta.get("username", "guest")
        role     = meta.get("role", "developer")
        emoji    = {"hr": "🏢", "manager": "👔", "developer": "💻"}.get(role, "👤")

        dispatcher.utter_message(
            f"{emoji} Welcome {username}! Logged in as {role.upper()}.\n"
            f"Ask me about employees, leave, attendance, tasks, payroll or announcements."
        )
        return [
            SessionStarted(),
            SlotSet("logged_in_user", username),
            SlotSet("user_role",      role),
            ActionExecuted("action_listen"),
        ]


# ══════════════════════════════════════════════════════════════════
# 2. EMPLOYEE — List all
# ══════════════════════════════════════════════════════════════════
class ActionListEmployees(Action):
    def name(self): return "action_list_employees"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        rows = run_query(
            "SELECT name, role, department FROM employees ORDER BY department, name"
        )
        if not rows:
            dispatcher.utter_message("No employees found.")
            return []
        dispatcher.utter_message(
            f"👥 All Employees ({len(rows)}):\n" + fmt_rows(rows, ["name", "role", "department"])
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 3. EMPLOYEE — Single field query
# ══════════════════════════════════════════════════════════════════
class ActionPersonQuery(Action):
    def name(self): return "action_person_query"

    def run(self, dispatcher, tracker, domain):
        role   = get_slot(tracker, "user_role",      "developer")
        me     = get_slot(tracker, "logged_in_user", "")
        text   = tracker.latest_message["text"].lower()
        intent = tracker.latest_message["intent"]["name"]
        field  = INTENT_FIELD_MAP.get(intent)

        if not field:
            dispatcher.utter_message("I cannot identify the requested detail.")
            return []
        if field == "salary" and lvl(role) < 2:
            deny(dispatcher)
            return []
        if field not in ALLOWED_EMP_FIELDS:
            dispatcher.utter_message("That field is not allowed.")
            return []

        if lvl(role) < 2:
            rows = run_query(
                f"SELECT name, {field} FROM employees WHERE LOWER(username)=%s",
                (me.lower(),)
            )
            if rows:
                r = rows[0]
                dispatcher.utter_message(
                    f"✅ {r['name']}'s {field.replace('_',' ')}: {r[field]}"
                )
            else:
                dispatcher.utter_message("Your record was not found.")
            return []

        names = extract_names(text)
        last  = get_slot(tracker, "last_employee")
        if not names and last:
            names = [last]
        if not names:
            dispatcher.utter_message("Please mention an employee name.")
            return []

        msg = ""
        for name in names:
            rows = run_query(
                f"SELECT name, {field} FROM employees WHERE LOWER(name)=%s",
                (name.lower(),)
            )
            if rows:
                msg += f"✅ {rows[0]['name']}'s {field.replace('_',' ')}: {rows[0][field]}\n"

        dispatcher.utter_message(msg.strip() if msg else "No matching employee found.")
        if names:
            return [SlotSet("last_employee", names[-1])]
        return []


# ══════════════════════════════════════════════════════════════════
# 4. EMPLOYEE — Smart query
# ══════════════════════════════════════════════════════════════════
class ActionSmartEmployeeQuery(Action):
    def name(self): return "action_smart_employee_query"

    def run(self, dispatcher, tracker, domain):
        role  = get_slot(tracker, "user_role",      "developer")
        me    = get_slot(tracker, "logged_in_user", "")
        text  = tracker.latest_message["text"].lower()
        field = next((EMP_FIELD_MAP[k] for k in EMP_FIELD_MAP if k in text), None)

        if field == "salary" and lvl(role) < 2:
            deny(dispatcher)
            return []

        if lvl(role) < 2:
            rows = run_query(
                "SELECT * FROM employees WHERE LOWER(username)=%s", (me.lower(),)
            )
            if rows:
                row = rows[0]
                msg = (
                    f"✅ {row['name']}'s {field.replace('_',' ')}: {row.get(field,'N/A')}"
                    if field
                    else f"👤 {row['name']} | {row.get('role','N/A')} | {row.get('department','N/A')}"
                )
                dispatcher.utter_message(msg)
            else:
                dispatcher.utter_message("Your record was not found.")
            return []

        all_emp = run_query("SELECT * FROM employees ORDER BY id")
        if not all_emp:
            dispatcher.utter_message("No employees found.")
            return []

        names   = extract_names(text)
        indices = extract_indices(text)

        if names:
            ph   = ",".join(["%s"] * len(names))
            rows = run_query(
                f"SELECT * FROM employees WHERE LOWER(name) IN ({ph})",
                [n.lower() for n in names]
            )
        elif indices:
            rows = [all_emp[i] for i in indices if 0 <= i < len(all_emp)]
        else:
            rows = all_emp

        if not rows:
            dispatcher.utter_message("No matching employees found.")
            return []

        msg = ""
        for row in rows:
            msg += (
                f"✅ {row['name']}'s {field.replace('_',' ')}: {row.get(field,'N/A')}\n"
                if field
                else f"👤 {row['name']} | {row.get('role','N/A')} | {row.get('department','N/A')}\n"
            )
        dispatcher.utter_message(msg.strip())
        if names:
            return [SlotSet("last_employee", names[-1])]
        return []


# ══════════════════════════════════════════════════════════════════
# 5. EMPLOYEE — Count
# ══════════════════════════════════════════════════════════════════
class ActionCountEmployees(Action):
    def name(self): return "action_count_employees"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        total = run_query("SELECT COUNT(*) AS c FROM employees")[0]["c"]
        dept  = run_query(
            "SELECT department, COUNT(*) AS c FROM employees GROUP BY department"
        )
        msg = f"👥 Total: {total}\n"
        for d in dept:
            msg += f"  • {d['department']}: {d['c']}\n"
        dispatcher.utter_message(msg.strip())
        return []


# ══════════════════════════════════════════════════════════════════
# 6. EMPLOYEE PROFILES
# ══════════════════════════════════════════════════════════════════
class ActionGetProfile(Action):
    def name(self): return "action_get_profile"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        if lvl(role) >= 2:
            names = extract_names(text)
            if names:
                rows = run_query(
                    "SELECT * FROM employee_profiles WHERE LOWER(username)=%s",
                    (names[0].lower(),)
                )
            else:
                rows = run_query(
                    "SELECT username, full_name, department, position, email, phone, join_date "
                    "FROM employee_profiles ORDER BY department"
                )
            dispatcher.utter_message(
                f"👤 Profile:\n{fmt_rows(rows)}" if rows else "No profile found."
            )
        else:
            rows = run_query(
                "SELECT * FROM employee_profiles WHERE username=%s", (me,)
            )
            dispatcher.utter_message(
                f"👤 Your Profile:\n{fmt_rows(rows)}" if rows else "Profile not found."
            )
        return []


# ══════════════════════════════════════════════════════════════════
# 7. LEAVE — View
# ══════════════════════════════════════════════════════════════════
class ActionLeaveStatus(Action):
    def name(self): return "action_leave_status"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        if lvl(role) >= 2:
            names = extract_names(text)
            if names:
                rows = run_query(
                    "SELECT username, leave_type, from_date, to_date, status, reason "
                    "FROM leave_requests WHERE LOWER(username)=%s ORDER BY applied_on DESC",
                    (names[0].lower(),)
                )
                title = f"🏖️ Leave for {names[0]}:"
            else:
                rows = run_query(
                    "SELECT username, leave_type, from_date, to_date, status "
                    "FROM leave_requests ORDER BY applied_on DESC LIMIT 20"
                )
                title = "🏖️ All Leave Requests (latest 20):"
        else:
            rows = run_query(
                "SELECT leave_type, from_date, to_date, status, reason "
                "FROM leave_requests WHERE username=%s ORDER BY applied_on DESC",
                (me,)
            )
            title = "🏖️ Your Leave Requests:"

        dispatcher.utter_message(
            f"{title}\n{fmt_rows(rows)}" if rows else f"{title}\nNo records found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 8. LEAVE — Apply
# ══════════════════════════════════════════════════════════════════
class ActionApplyLeave(Action):
    def name(self): return "action_apply_leave"

    def run(self, dispatcher, tracker, domain):
        me         = get_slot(tracker, "logged_in_user", "")
        leave_type = get_slot(tracker, "leave_type")
        from_date  = get_slot(tracker, "from_date")
        to_date    = get_slot(tracker, "to_date")
        reason     = get_slot(tracker, "reason")

        if not all([me, leave_type, from_date, to_date, reason]):
            dispatcher.utter_message("❌ Missing details. Please provide all leave info.")
            return []

        overlap = run_query(
            "SELECT id FROM leave_requests WHERE username=%s "
            "AND status != 'rejected' AND NOT (to_date < %s OR from_date > %s)",
            (me, from_date, to_date)
        )
        if overlap:
            dispatcher.utter_message("❌ You already have an overlapping leave request.")
            return []

        result = run_query(
            "INSERT INTO leave_requests (username, leave_type, from_date, to_date, reason) "
            "VALUES (%s, %s, %s, %s, %s)",
            (me, leave_type, from_date, to_date, reason), write=True
        )

        if result:
            dispatcher.utter_message(
                f"✅ Leave applied!\n"
                f"  Type   : {leave_type}\n"
                f"  From   : {from_date}\n"
                f"  To     : {to_date}\n"
                f"  Reason : {reason}\n"
                f"  Status : ⏳ Pending approval"
            )
        else:
            dispatcher.utter_message("❌ Failed to apply leave. Try again.")

        return [
            SlotSet("leave_type", None), SlotSet("from_date",  None),
            SlotSet("to_date",    None), SlotSet("reason",     None),
        ]


# ══════════════════════════════════════════════════════════════════
# 9. LEAVE — Approve / Reject
# ══════════════════════════════════════════════════════════════════
class ActionApproveLeave(Action):
    def name(self): return "action_approve_leave"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        names = extract_names(tracker.latest_message["text"])
        if not names:
            dispatcher.utter_message("Which employee's leave do you want to approve?")
            return []
        r = run_query(
            "UPDATE leave_requests SET status='approved' "
            "WHERE username=%s AND status='pending'",
            (names[0],), write=True
        )
        dispatcher.utter_message(
            f"✅ Leave approved for {names[0]}." if r else f"No pending leave for {names[0]}."
        )
        return []


class ActionRejectLeave(Action):
    def name(self): return "action_reject_leave"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        names = extract_names(tracker.latest_message["text"])
        if not names:
            dispatcher.utter_message("Which employee's leave do you want to reject?")
            return []
        r = run_query(
            "UPDATE leave_requests SET status='rejected' "
            "WHERE username=%s AND status='pending'",
            (names[0],), write=True
        )
        dispatcher.utter_message(
            f"❌ Leave rejected for {names[0]}." if r else f"No pending leave for {names[0]}."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 10. LEAVE — Who is on leave today
# ══════════════════════════════════════════════════════════════════
class ActionOnLeaveToday(Action):
    def name(self): return "action_on_leave_today"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        today = date.today().isoformat()
        rows  = run_query(
            "SELECT username, leave_type FROM leave_requests "
            "WHERE %s BETWEEN from_date AND to_date AND status='approved'",
            (today,)
        )
        if rows:
            msg = f"🏖️ On approved leave today ({today}):\n"
            for r in rows:
                msg += f"  • {r['username']} — {r['leave_type']}\n"
            dispatcher.utter_message(msg.strip())
        else:
            dispatcher.utter_message(f"✅ No one is on leave today ({today}).")
        return []


# ══════════════════════════════════════════════════════════════════
# 11. PAYROLL — View
# ══════════════════════════════════════════════════════════════════
class ActionGetPayroll(Action):
    def name(self): return "action_get_payroll"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        if lvl(role) == 3:
            names = extract_names(text)
            if names:
                rows = run_query(
                    "SELECT month, basic_salary, bonus, deductions, net_salary "
                    "FROM payroll WHERE username=%s ORDER BY month DESC",
                    (names[0],)
                )
                title = f"💰 Payroll for {names[0]}:"
            else:
                rows = run_query(
                    "SELECT username, month, basic_salary, bonus, deductions, net_salary "
                    "FROM payroll ORDER BY month DESC, username"
                )
                title = "💰 All Payroll:"
        else:
            rows = run_query(
                "SELECT month, basic_salary, bonus, deductions, net_salary "
                "FROM payroll WHERE username=%s ORDER BY month DESC LIMIT 3",
                (me,)
            )
            title = "💰 Your Last 3 Payslips:"

        dispatcher.utter_message(
            f"{title}\n{fmt_rows(rows)}" if rows else f"{title}\nNo payroll records found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 12. ATTENDANCE — View
# ══════════════════════════════════════════════════════════════════
class ActionAttendance(Action):
    def name(self): return "action_attendance"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        if lvl(role) >= 2:
            names = extract_names(text)
            if names:
                rows = run_query(
                    "SELECT date, check_in, check_out, status FROM attendance "
                    "WHERE username=%s ORDER BY date DESC LIMIT 10",
                    (names[0],)
                )
                title = f"📅 Attendance for {names[0]} (last 10):"
            else:
                today = date.today().isoformat()
                rows  = run_query(
                    "SELECT username, check_in, check_out, status "
                    "FROM attendance WHERE date=%s ORDER BY username",
                    (today,)
                )
                title = f"📅 Today's Attendance ({today}):"
        else:
            rows = run_query(
                "SELECT date, check_in, check_out, status FROM attendance "
                "WHERE username=%s ORDER BY date DESC LIMIT 10",
                (me,)
            )
            title = "📅 Your Attendance (last 10 days):"

        dispatcher.utter_message(
            f"{title}\n{fmt_rows(rows)}" if rows else f"{title}\nNo records found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 13. ATTENDANCE — Who is absent today
# ══════════════════════════════════════════════════════════════════
class ActionAbsentToday(Action):
    def name(self): return "action_absent_today"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        if lvl(role) < 2:
            deny(dispatcher)
            return []
        today = date.today().isoformat()
        rows  = run_query(
            "SELECT username FROM attendance WHERE date=%s AND status='absent'",
            (today,)
        )
        if rows:
            names = ", ".join(r["username"] for r in rows)
            dispatcher.utter_message(f"❌ Absent today ({today}): {names}")
        else:
            dispatcher.utter_message(f"✅ Everyone is present today ({today})!")
        return []


# ══════════════════════════════════════════════════════════════════
# 14. TASKS — View (chattybot → tasks)
# ══════════════════════════════════════════════════════════════════
class ActionTasks(Action):
    def name(self): return "action_tasks"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        if lvl(role) == 3:
            rows  = run_task_query(
                "SELECT assigned_to, task_description, priority, status, deadline "
                "FROM tasks ORDER BY deadline"
            )
            title = "📋 All Tasks:"
        elif lvl(role) == 2:
            names = extract_names(text)
            if names:
                rows = run_task_query(
                    "SELECT task_description, priority, status, deadline "
                    "FROM tasks WHERE LOWER(assigned_to)=%s ORDER BY deadline",
                    (names[0].lower(),)
                )
                title = f"📋 Tasks for {names[0]}:"
            else:
                rows = run_task_query(
                    "SELECT assigned_to, task_description, priority, status, deadline "
                    "FROM tasks WHERE assigned_by=%s ORDER BY deadline",
                    (me,)
                )
                title = "📋 Tasks you assigned:"
        else:
            rows = run_task_query(
                "SELECT task_description, priority, status, deadline "
                "FROM tasks WHERE assigned_to=%s ORDER BY deadline",
                (me,)
            )
            pending = sum(1 for r in rows if r["status"] == "pending")
            done    = sum(1 for r in rows if r["status"] == "completed")
            title   = f"📋 Your Tasks — ⏳ Pending: {pending} | ✅ Done: {done}"

        dispatcher.utter_message(
            f"{title}\n{fmt_rows(rows)}" if rows else f"{title}\nNo tasks found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 15. TASKS — Assign new task (form-based)
#     ✅ Stored in chattybot → tasks (shared with Gemini)
#     HR + Manager only
# ══════════════════════════════════════════════════════════════════
class ActionAssignTask(Action):
    def name(self): return "action_assign_task"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")

        if lvl(role) < 2:
            deny(dispatcher)
            return []

        assigned_to = get_slot(tracker, "assign_to")
        task_desc   = get_slot(tracker, "task_desc")
        priority    = get_slot(tracker, "priority") or "medium"
        deadline    = get_slot(tracker, "deadline")

        if not all([assigned_to, task_desc, deadline]):
            dispatcher.utter_message("❌ Missing details. Please provide all task info.")
            return []

        if priority not in ["high", "medium", "low"]:
            priority = "medium"

        try:
            datetime.strptime(deadline, "%Y-%m-%d")
        except ValueError:
            dispatcher.utter_message("❌ Invalid deadline. Use YYYY-MM-DD.")
            return []

        # ✅ INSERT into chattybot → tasks (shared with Gemini)
        result = run_task_query(
            "INSERT INTO tasks "
            "(assigned_by, assigned_to, task_description, priority, status, deadline) "
            "VALUES (%s, %s, %s, %s, 'pending', %s)",
            (me, assigned_to, task_desc, priority, deadline),
            write=True
        )

        if result:
            dispatcher.utter_message(
                f"✅ Task assigned and saved!\n"
                f"  Assigned by : {me}\n"
                f"  Assigned to : {assigned_to}\n"
                f"  Task        : {task_desc}\n"
                f"  Priority    : {priority}\n"
                f"  Deadline    : {deadline}\n"
                f"  Status      : pending\n"
                f"  DB          : chattybot → tasks ✅"
            )
        else:
            dispatcher.utter_message("❌ Failed to assign task. Try again.")

        return [
            SlotSet("assign_to", None),
            SlotSet("task_desc", None),
            SlotSet("priority",  None),
            SlotSet("deadline",  None),
        ]


# ══════════════════════════════════════════════════════════════════
# 16. TASKS — Update status (chattybot → tasks)
# ══════════════════════════════════════════════════════════════════
class ActionUpdateTask(Action):
    def name(self): return "action_update_task"

    def run(self, dispatcher, tracker, domain):
        me   = get_slot(tracker, "logged_in_user", "")
        text = tracker.latest_message["text"].lower()

        status = None
        if any(w in text for w in ["complet", "done", "finish"]):
            status = "completed"
        elif any(w in text for w in ["start", "progress", "working", "begin"]):
            status = "in_progress"
        elif "pending" in text:
            status = "pending"

        if not status:
            dispatcher.utter_message("Say: mark task as completed / in progress / pending")
            return []

        m = re.search(r'task\s*#?(\d+)', text)
        if m:
            r = run_task_query(
                "UPDATE tasks SET status=%s WHERE id=%s AND assigned_to=%s",
                (status, int(m.group(1)), me), write=True
            )
        else:
            r = run_task_query(
                "UPDATE tasks SET status=%s WHERE assigned_to=%s "
                "AND status='pending' ORDER BY deadline ASC LIMIT 1",
                (status, me), write=True
            )

        dispatcher.utter_message(
            f"✅ Task marked as {status}." if r else "❌ Task not found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 17. PROJECTS — View (rasadb)
# ══════════════════════════════════════════════════════════════════
class ActionProjects(Action):
    def name(self): return "action_projects"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role",      "developer")
        me   = get_slot(tracker, "logged_in_user", "")

        if lvl(role) >= 2:
            rows  = run_query(
                "SELECT project_name, manager, status, deadline "
                "FROM project_tracker ORDER BY deadline"
            )
            title = f"🗂️ All Projects ({len(rows)}):"
        else:
            rows = run_query(
                "SELECT project_name, manager, status, deadline "
                "FROM project_tracker WHERE team_members LIKE %s ORDER BY deadline",
                (f"%{me}%",)
            )
            title = "🗂️ Your Projects:"

        dispatcher.utter_message(
            f"{title}\n{fmt_rows(rows, ['project_name','manager','status','deadline'])}"
            if rows else f"{title}\nNo projects found."
        )
        return []


# ══════════════════════════════════════════════════════════════════
# 18. ANNOUNCEMENTS — Everyone reads (rasadb)
# ══════════════════════════════════════════════════════════════════
class ActionAnnouncements(Action):
    def name(self): return "action_announcements"

    def run(self, dispatcher, tracker, domain):
        rows = run_query(
            "SELECT title, posted_by, posted_on FROM announcements "
            "ORDER BY posted_on DESC LIMIT 5"
        )
        if not rows:
            dispatcher.utter_message("No announcements found.")
            return []
        msg = "📢 Latest Announcements:\n"
        for i, r in enumerate(rows, 1):
            msg += f"{i}. {r['title']} — by {r['posted_by']} on {r['posted_on']}\n"
        dispatcher.utter_message(msg.strip())
        return []


# ══════════════════════════════════════════════════════════════════
# 19. DATABASE ANALYTICS — HR only (rasadb)
# ══════════════════════════════════════════════════════════════════
class ActionDbInfo(Action):
    def name(self): return "action_db_info"

    def run(self, dispatcher, tracker, domain):
        role   = get_slot(tracker, "user_role", "developer")
        intent = tracker.latest_message["intent"]["name"]

        if lvl(role) < 3:
            deny(dispatcher)
            return []

        if intent == "ask_db_rows":
            r = run_query("SELECT COUNT(*) AS c FROM employees")[0]["c"]
            dispatcher.utter_message(f"📊 Total employee rows: {r}")
        elif intent == "ask_db_columns":
            r = run_query(
                "SELECT COUNT(*) AS c FROM information_schema.columns "
                "WHERE table_schema='rasaai_db' AND table_name='employees'"
            )[0]["c"]
            dispatcher.utter_message(f"📊 Columns in employees: {r}")
        elif intent == "ask_db_column_names":
            rows = run_query(
                "SELECT COLUMN_NAME FROM information_schema.columns "
                "WHERE table_schema='rasaai_db' AND table_name='employees'"
            )
            dispatcher.utter_message(
                "📋 Columns: " + ", ".join(r["COLUMN_NAME"] for r in rows)
            )
        elif intent == "ask_db_avg_salary":
            r = run_query("SELECT ROUND(AVG(salary),2) AS a FROM employees")[0]["a"]
            dispatcher.utter_message(f"💰 Average salary: ₹{r:,}")
        elif intent == "ask_db_total_salary":
            r = run_query("SELECT SUM(salary) AS s FROM employees")[0]["s"]
            dispatcher.utter_message(f"💰 Total salary: ₹{r:,}")
        return []


# ══════════════════════════════════════════════════════════════════
# 20. SMART FALLBACK — role-based suggestions
# ══════════════════════════════════════════════════════════════════
class ActionDefaultFallback(Action):
    def name(self): return "action_default_fallback"

    def run(self, dispatcher, tracker, domain):
        role = get_slot(tracker, "user_role", "developer")
        msg  = "😕 I didn't understand. Here's what I can help with:\n\n"
        msg += "👤 Employee  : 'Nithesh phone' | 'Gopi department' | 'list employees'\n"
        msg += "🏖️ Leave     : 'my leave' | 'apply leave' | 'who is on leave today'\n"
        msg += "📅 Attendance: 'my attendance' | 'today attendance'\n"
        msg += "📋 Tasks     : 'my tasks' | 'mark task completed'\n"
        msg += "📢 Notices   : 'show announcements'\n"
        if lvl(role) >= 2:
            msg += "✅ Approve   : 'approve Nithesh leave' | 'reject Gopi leave'\n"
            msg += "➕ Assign    : 'assign task to Nithesh'\n"
            msg += "🗂️ Projects  : 'show projects'\n"
        if lvl(role) == 3:
            msg += "💰 Payroll   : 'show all payroll' | 'average salary' | 'total salary'\n"
        dispatcher.utter_message(msg.strip())
        return [UserUtteranceReverted()]


# ══════════════════════════════════════════════════════════════════
# 21. LEAVE FORM VALIDATION
# ══════════════════════════════════════════════════════════════════
class ValidateLeaveForm(FormValidationAction):
    def name(self): return "validate_leave_form"

    def validate_leave_type(self, slot_value, dispatcher, tracker, domain):
        valid = ["Sick Leave", "Casual Leave", "Annual Leave",
                 "Maternity Leave", "Paternity Leave"]
        if slot_value in valid:
            return {"leave_type": slot_value}
        dispatcher.utter_message(
            "Choose: Sick Leave | Casual Leave | Annual Leave | "
            "Maternity Leave | Paternity Leave"
        )
        return {"leave_type": None}

    def validate_from_date(self, slot_value, dispatcher, tracker, domain):
        try:
            d = datetime.strptime(slot_value, "%Y-%m-%d").date()
            if d < date.today():
                dispatcher.utter_message("From date cannot be in the past.")
                return {"from_date": None}
            return {"from_date": slot_value}
        except:
            dispatcher.utter_message("Use format YYYY-MM-DD e.g. 2025-05-10")
            return {"from_date": None}

    def validate_to_date(self, slot_value, dispatcher, tracker, domain):
        from_date = tracker.get_slot("from_date")
        try:
            to  = datetime.strptime(slot_value,  "%Y-%m-%d").date()
            frm = datetime.strptime(from_date, "%Y-%m-%d").date() if from_date else None
            if frm and to < frm:
                dispatcher.utter_message("To date cannot be before From date.")
                return {"to_date": None}
            return {"to_date": slot_value}
        except:
            dispatcher.utter_message("Use format YYYY-MM-DD e.g. 2025-05-15")
            return {"to_date": None}


# ══════════════════════════════════════════════════════════════════
# 22. ASSIGN TASK FORM VALIDATION
# ══════════════════════════════════════════════════════════════════
class ValidateAssignTaskForm(FormValidationAction):
    def name(self): return "validate_assign_task_form"

    def validate_assign_to(self, slot_value, dispatcher, tracker, domain):
        if slot_value and len(slot_value.strip()) > 0:
            return {"assign_to": slot_value.strip().lower()}
        dispatcher.utter_message("Please enter a valid username.")
        return {"assign_to": None}

    def validate_task_desc(self, slot_value, dispatcher, tracker, domain):
        if slot_value and len(slot_value.strip()) > 5:
            return {"task_desc": slot_value.strip()}
        dispatcher.utter_message("Please provide a proper task description.")
        return {"task_desc": None}

    def validate_priority(self, slot_value, dispatcher, tracker, domain):
        if slot_value and slot_value.lower() in ["high", "medium", "low"]:
            return {"priority": slot_value.lower()}
        dispatcher.utter_message("Priority must be: high / medium / low")
        return {"priority": None}

    def validate_deadline(self, slot_value, dispatcher, tracker, domain):
        try:
            d = datetime.strptime(slot_value, "%Y-%m-%d").date()
            if d < date.today():
                dispatcher.utter_message("Deadline cannot be in the past.")
                return {"deadline": None}
            return {"deadline": slot_value}
        except:
            dispatcher.utter_message("Use format YYYY-MM-DD e.g. 2025-05-20")
            return {"deadline": None}