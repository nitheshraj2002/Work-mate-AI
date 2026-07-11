from google import genai

client = genai.Client(api_key="AIzaSyBfB3JKVGI0tz0bvrqScgxvXt2seaqu1Ew")

print("Available models:")
for m in client.models.list():
    print(m.name)