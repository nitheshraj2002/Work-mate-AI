from google import genai

API_KEY = "AIzaSyBfB3JKVGI0tz0bvrqScgxvXt2seaqu1Ew"
client  = genai.Client(api_key=API_KEY)
MODEL   = "gemini-2.5-flash"

print("=" * 50)
print("GEMINI TEST SCRIPT")
print("=" * 50)

# ── TEST 1: Normal chat ────────────────────────────
print("\n🧪 TEST 1: Normal Chat")
try:
    res = client.models.generate_content(
        model=MODEL,
        contents="What is 2 + 2? Answer in one line."
    )
    print(f"✅ Reply: {res.text.strip()}")
except Exception as e:
    print(f"❌ Failed: {e}")

# ── TEST 2: TXT file simulation ────────────────────
print("\n🧪 TEST 2: TXT File")
try:
    txt_content = "Employee: John\nSalary: 50000\nDepartment: HR"
    prompt = f"=== FILE: test.txt ===\n{txt_content}\n=== END ===\nWhat is John's salary?"
    res = client.models.generate_content(model=MODEL, contents=prompt)
    print(f"✅ Reply: {res.text.strip()}")
except Exception as e:
    print(f"❌ Failed: {e}")

# ── TEST 3: CSV simulation ─────────────────────────
print("\n🧪 TEST 3: CSV Data")
try:
    csv_content = "Name,Salary,Dept\nAlice,60000,IT\nBob,45000,HR\nCharlie,70000,IT"
    prompt = f"=== FILE: data.csv ===\n{csv_content}\n=== END ===\nWho has the highest salary?"
    res = client.models.generate_content(model=MODEL, contents=prompt)
    print(f"✅ Reply: {res.text.strip()}")
except Exception as e:
    print(f"❌ Failed: {e}")

# ── TEST 4: Flask API test ─────────────────────────
print("\n🧪 TEST 4: Flask API (/ai_chat)")
try:
    import requests
    res = requests.post("http://localhost:5001/ai_chat", json={
        "message":         "say hello",
        "role":            "developer",
        "user_id":         1,
        "username":        "test",
        "conversation_id": "test-123"
    }, timeout=10)
    data = res.json()
    print(f"✅ Flask Reply: {data.get('reply', data)}")
except Exception as e:
    print(f"❌ Flask Failed: {e}")

# ── TEST 5: File upload API test ───────────────────
print("\n🧪 TEST 5: Flask /upload_file")
try:
    import requests
    import io
    txt = b"Name: Alice\nSalary: 60000\nDept: IT"
    res = requests.post("http://localhost:5001/upload_file",
        data={"question": "what is Alice salary?", "role": "user", "username": "test"},
        files={"file": ("test.txt", io.BytesIO(txt), "text/plain")},
        timeout=15
    )
    data = res.json()
    print(f"✅ Upload Reply: {data.get('reply', data)}")
except Exception as e:
    print(f"❌ Upload Failed: {e}")

print("\n" + "=" * 50)
print("TEST COMPLETE")
print("=" * 50)