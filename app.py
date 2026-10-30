
from flask import Flask, render_template, request, jsonify
import sqlite3
import os

app = Flask(__name__)

DATABASE = os.path.join(app.root_path, "parking.db")


# Connect to SQLite database
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# Create database tables
def init_db():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS players (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            player_id INTEGER NOT NULL,
            level INTEGER NOT NULL,
            score INTEGER NOT NULL,
            parking_time REAL NOT NULL,
            car_condition INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (player_id) REFERENCES players(id)
        )
    """)

    conn.commit()
    conn.close()


# Home page
@app.route("/")
def home():
    return render_template("index.html")


# Save player score
@app.route("/api/save-score", methods=["POST"])
def save_score():
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "Player")).strip()
    
    if not username or len(username) > 30:
        return jsonify({
            "success": False,
            "message": "Username must be between 1 and 30 characters."
        }), 400

    try:
        level = int(data.get("level", 1))
        parking_time = float(data.get("parking_time", 0))
        car_condition = int(data.get("car_condition", 100))

        if not 1 <= level <= 100:
            raise ValueError()

        if not 0 <= parking_time <= 86400:
            raise ValueError()

        if not 0 <= car_condition <= 100:
            raise ValueError()

    except (TypeError, ValueError):
        return jsonify({
            "success": False,
            "message": "Invalid score information."
        }), 400

    # Calculate score on the server
    score = max(
        0,
        (level * 1000)
        + (car_condition * 10)
        - int(parking_time * 2)
    )

    conn = get_db()

    try:
        conn.execute(
            "INSERT OR IGNORE INTO players (username) VALUES (?)",
            (username,)
        )

        player = conn.execute(
            "SELECT id FROM players WHERE username = ?",
            (username,)
        ).fetchone()

        conn.execute("""
            INSERT INTO scores
            (player_id, level, score, parking_time, car_condition)
            VALUES (?, ?, ?, ?, ?)
        """, (
            player["id"],
            level,
            score,
            parking_time,
            car_condition
        ))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Score saved successfully!",
            "score": score
        })

    except sqlite3.Error:
        conn.rollback()

        return jsonify({
            "success": False,
            "message": "Database error."
        }), 500

    finally:
        conn.close()


# Get leaderboard
@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():
    conn = get_db()

    rows = conn.execute("""
        SELECT
            players.username,
            MAX(scores.score) AS best_score,
            MAX(scores.level) AS highest_level
        FROM players
        JOIN scores ON players.id = scores.player_id
        GROUP BY players.id
        ORDER BY best_score DESC
        LIMIT 10
    """).fetchall()

    conn.close()

    return jsonify([
        {
            "username": row["username"],
            "best_score": row["best_score"],
            "highest_level": row["highest_level"]
        }
        for row in rows
    ])


# Player history
@app.route("/api/history/<username>", methods=["GET"])
def player_history(username):
    conn = get_db()

    rows = conn.execute("""
        SELECT level, score, parking_time,
               car_condition, created_at
        FROM scores
        JOIN players ON scores.player_id = players.id
        WHERE players.username = ?
        ORDER BY scores.created_at DESC
        LIMIT 20
    """, (username,)).fetchall()

    conn.close()

    return jsonify([dict(row) for row in rows])


if __name__ == "__main__":
    init_db()

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
