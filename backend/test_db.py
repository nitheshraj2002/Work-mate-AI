import mysql.connector
from mysql.connector import Error

try:
    conn = mysql.connector.connect(
        host="localhost",
        user="root",
        password="Nithesh2002@Raj",
        database="chattybot",
        port=2002  # Make sure this matches your MySQL port
    )
    if conn.is_connected():
        print("✅ Database connected successfully!")
    else:
        print("❌ Failed to connect to database.")
except Error as e:
    print("❌ Database connection error:", e)
finally:
    if 'conn' in locals() and conn.is_connected():
        conn.close()