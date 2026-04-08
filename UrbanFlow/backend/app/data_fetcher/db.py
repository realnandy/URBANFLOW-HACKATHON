"""
Database layer — async SQLite for event logging and persistence.
Replaces PostgreSQL/Redis for hackathon portability.
"""

import json
import time
from pathlib import Path
from typing import Optional

import aiosqlite


class Database:
    """Async SQLite database for event logging."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self.conn: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Create the database and tables."""
        self.conn = await aiosqlite.connect(self.db_path)
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                payload TEXT NOT NULL,
                timestamp REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS traffic_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                snapshot TEXT NOT NULL,
                timestamp REAL NOT NULL
            )
        """)
        await self.conn.commit()
        print(f"[DB] SQLite initialized at {self.db_path}")

    async def log_event(self, event_type: str, payload: dict):
        """Log an event to the database."""
        if self.conn is None:
            return
        await self.conn.execute(
            "INSERT INTO events (event_type, payload, timestamp) VALUES (?, ?, ?)",
            (event_type, json.dumps(payload), time.time()),
        )
        await self.conn.commit()

    async def get_recent_events(self, limit: int = 50) -> list[dict]:
        """Retrieve recent events."""
        if self.conn is None:
            return []
        cursor = await self.conn.execute(
            "SELECT id, event_type, payload, timestamp FROM events ORDER BY id DESC LIMIT ?",
            (limit,),
        )
        rows = await cursor.fetchall()
        return [
            {
                "id": row[0],
                "event_type": row[1],
                "payload": json.loads(row[2]),
                "timestamp": row[3],
            }
            for row in rows
        ]

    async def save_snapshot(self, snapshot: dict):
        """Save a traffic snapshot."""
        if self.conn is None:
            return
        await self.conn.execute(
            "INSERT INTO traffic_snapshots (snapshot, timestamp) VALUES (?, ?)",
            (json.dumps(snapshot), time.time()),
        )
        await self.conn.commit()

    async def close(self):
        """Close the database connection."""
        if self.conn:
            await self.conn.close()
            print("[DB] SQLite connection closed.")
