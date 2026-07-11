import mysql.connector
from mysql.connector import Error

db_config = {
    "user": "root",
    "password": "Nithesh2002@Raj",
    "host": "localhost",
    "port": 2002,
    "database": "chattybot"
}

def get_db():
    try:
        conn = mysql.connector.connect(**db_config)
        return conn
    except Error as e:
        print("DB Connection Error:", e)
        return None