import base64
import json
import os

import psycopg2

DB_HOST = "127.0.0.1"  # Switched to localhost for Cloud SQL Proxy
DB_PORT = "5432"
DB_NAME = "rap"
DB_USER = "postgres"
DB_PASSWORD = ""

# Paths
JSON_FILE = "sample_json.json"
AUDIO_DIR = "RECORDED_AUDIOS_CLONE"


def upload_data():
    print(f"Connecting to database at {DB_HOST}:{DB_PORT} via proxy...")
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            # Removed connect_timeout
        )
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    try:
        with open(JSON_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading {JSON_FILE}: {e}")
        conn.close()
        return

    for entry in data:
        text = entry.get("text")
        audio_filename = entry.get("audio")
        gender = entry.get("gender")
        # Hardcoding default values from your image/context if they aren't in JSON
        audio_format = "wav"
        language_id = 163

        audio_path = os.path.join(AUDIO_DIR, audio_filename)

        try:
            with conn.cursor() as cur:
                with open(audio_path, "rb") as audio_file:
                    audio_data = audio_file.read()
                    audio_base64 = base64.b64encode(audio_data).decode("utf-8")

                # Assuming the image is for main_cachetts
                cur.execute(
                    """
                    INSERT INTO main_cachetts
                    (text, audio_data, audio_format, language_id, gender)
                    VALUES (%s, %s, %s, %s, %s)
                    """,
                    (text, audio_base64, audio_format, language_id, gender),
                )
            conn.commit()
            print(f"Successfully uploaded: {audio_filename}")
        except FileNotFoundError:
            print(f"Warning: Audio file not found: {audio_path}")
        except Exception as e:
            print(f"Error uploading {audio_filename}: {e}")
            conn.rollback()

    print("Upload complete!")
    conn.close()


if __name__ == "__main__":
    upload_data()
