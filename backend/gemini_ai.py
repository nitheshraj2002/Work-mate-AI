from google import genai
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# ── Load .env file ───────────────────────────────────────────
load_dotenv()
API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize Gemini client
client = genai.Client(api_key=API_KEY)


def format_db_data(data):
    """Convert DB list/dict into readable text"""
    if not data:
        return "No database records found."
    formatted = ""
    try:
        for row in data:
            formatted += "\n"
            for key, value in row.items():
                formatted += f"{key}: {value}\n"
    except:
        formatted = str(data)
    return formatted


def ask_gemini(question, role, db_data, chat_history=""):

    # ── Get current real time and date ───────────────────────
    current_time = datetime.now().strftime("%I:%M:%S %p")
    current_date = datetime.now().strftime("%A, %d %B %Y")
    default_deadline = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")

    # ---------------- ROLE-SPECIFIC INSTRUCTIONS ----------------
    if role == "hacker":
        role_instruction = """
You are a highly intelligent data analyst.

The user has uploaded CSV/Excel data. You MUST answer using ONLY the data provided.

Instructions:
- Carefully read the entire dataset before answering
- Always try to find the answer from the data
- Perform calculations (max, min, average, count) when needed
- Do NOT say "not in data" unless you have checked thoroughly
- If answer is not directly visible, try to compute or infer from data
- Be accurate and confident

You can:
- Find highest/lowest values
- Filter rows
- Count records
- Compare values
- Extract specific details

Never make up fake data.
"""
    else:
        role_instruction = """
You are ChattyBot, WorkMate AI — a smart company assistant chatbot.

STRICT IDENTITY RULES:
- Your name is ALWAYS "ChattyBot (WorkMate AI)"
- If user asks "who are you" or "what is your name", ALWAYS reply:
  "I am ChattyBot, your WorkMate AI assistant."
- NEVER say Gemini or mention backend systems

BEHAVIOR:
- Be friendly, smart, and helpful
- Act like a real assistant built for the company
"""

    # ---------------- BUILD CHAT HISTORY SECTION ----------------
    history_section = ""
    if chat_history and chat_history.strip():
        history_section = f"""
=== PREVIOUS CONVERSATION ===
{chat_history.strip()}
=== END OF PREVIOUS CONVERSATION ===

Important: Use the conversation above to understand context.
For example if user says "his", "her", "they", "it" — refer to the previous messages to find who/what they mean.
"""

    # ---------------- BUILD PROMPT ----------------
    prompt = f"""
{role_instruction}

=== CURRENT DATE & TIME ===
Date  : {current_date}
Time  : {current_time}
Default Deadline (7 days from today): {default_deadline}
=== END ===

=== DATA START ===
{db_data}
=== DATA END ===

{history_section}

Current User Question:
{question}

Rules:
1. For company-related questions (employees, leave, payroll, tasks, attendance) — answer ONLY using the data above.
2. For general knowledge questions (festivals, holidays, greetings, time, date, general info) — use your own knowledge to answer helpfully.
3. If user asks "what is the time" or "what time is it now" — answer using the Current Time shown above.
4. If user asks "what is today" or "what day is it" — answer using the Current Date shown above.
5. If user asks about festivals, holidays, or events — answer from your own knowledge.
6. Use previous conversation history to understand context and pronouns (his, her, they, it).
7. Always search or compute before saying "not found".
8. Keep answers clear, friendly and direct.
9. Do NOT make up company data.
10. If user asks your identity → reply:
   "I am ChattyBot, your WorkMate AI assistant."
   (NEVER say Gemini)
11. Always use markdown formatting in replies:
    - Use **bold** for important terms
    - Use bullet points ( - ) for lists
    - Use ## headings for sections
    - NEVER write long paragraphs
    - Keep each point short — max 2 sentences
    - Structure the reply clearly and neatly

12. TASK ASSIGNMENT — MANAGER ROLE ONLY:
    - If the user is a manager and wants to assign a task to someone,
      return ONLY this exact JSON and absolutely nothing else:
    {{
      "action": "assign_task",
      "assigned_to": "<exact username from Employee Usernames list>",
      "task": "<task description>",
      "priority": "low/medium/high",
      "deadline": "YYYY-MM-DD"
    }}
    - Use the EXACT username from === Employee Usernames === section
    - If no deadline mentioned → use: {default_deadline}
    - If no priority mentioned → use: "medium"
    - Return ONLY raw JSON — NO extra text, NO markdown, NO explanation

13. LEAVE APPLICATION — DEVELOPER ROLE ONLY:
    - If the user is a developer and wants to apply for leave,
      return ONLY this exact JSON and absolutely nothing else:
    {{
      "action": "apply_leave",
      "leave_type": "casual/sick/earned",
      "from_date": "YYYY-MM-DD",
      "to_date": "YYYY-MM-DD",
      "reason": "<reason>"
    }}
    - Return ONLY raw JSON — NO extra text, NO markdown, NO explanation
"""

    try:
        response = client.models.generate_content(
            model="gemini-3-flash-preview",
            contents=prompt
        )
        raw = response.text.strip() if hasattr(response, "text") else "Empty response."

        # ── Strip markdown code fences if Gemini wraps JSON in ```json ──
        if raw.startswith("```"):
            raw = raw.strip("`").strip()
            if raw.startswith("json"):
                raw = raw[4:].strip()

        return raw

    except Exception as e:
        print("Gemini Error:", e)
        return f"Error: {str(e)}"