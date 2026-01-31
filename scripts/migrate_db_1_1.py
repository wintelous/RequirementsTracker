#!/usr/bin/env python3
import sys
import sqlite3
from pathlib import Path


def table_exists(conn, name):
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name = ?;",
        (name,),
    ).fetchone()
    return row is not None


def column_exists(conn, table, column):
    rows = conn.execute(f"PRAGMA table_info({table});").fetchall()
    return any(row[1] == column for row in rows)


def migrate_requirements(conn):
    if not table_exists(conn, "requirements"):
        raise RuntimeError("Missing requirements table.")
    if column_exists(conn, "requirements", "type_id"):
        return
    if not column_exists(conn, "requirements", "type_code"):
        raise RuntimeError("requirements table missing type_code.")

    conn.execute("ALTER TABLE requirements RENAME TO requirements_old;")
    conn.executescript(
        "CREATE TABLE requirements ("
        "id INTEGER PRIMARY KEY, "
        "type_id INTEGER NOT NULL, "
        "num_path TEXT NOT NULL, "
        "display_code TEXT, "
        "title TEXT NOT NULL, "
        "description_md TEXT NOT NULL, "
        "rationale_md TEXT, "
        "parent_id INTEGER, "
        "order_index INTEGER NOT NULL DEFAULT 0, "
        "status_id INTEGER NOT NULL, "
        "source TEXT, "
        "created_at TEXT NOT NULL, "
        "updated_at TEXT NOT NULL, "
        "FOREIGN KEY (parent_id) REFERENCES requirements(id) ON DELETE CASCADE, "
        "FOREIGN KEY (status_id) REFERENCES statuses(id), "
        "FOREIGN KEY (type_id) REFERENCES types(id)"
        ");"
    )
    conn.executescript(
        "INSERT INTO requirements "
        "(id, type_id, num_path, display_code, title, description_md, rationale_md, "
        "parent_id, order_index, status_id, source, created_at, updated_at) "
        "SELECT r.id, t.id, r.num_path, r.display_code, r.title, r.description_md, "
        "r.rationale_md, r.parent_id, r.order_index, r.status_id, r.source, "
        "r.created_at, r.updated_at "
        "FROM requirements_old r "
        "JOIN types t ON t.type_code = r.type_code;"
    )
    conn.execute("DROP TABLE requirements_old;")
    conn.executescript(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_req_type_num "
        "ON requirements(type_id, num_path);"
        "CREATE INDEX IF NOT EXISTS idx_req_parent_order "
        "ON requirements(parent_id, order_index);"
        "CREATE INDEX IF NOT EXISTS idx_req_status "
        "ON requirements(status_id);"
    )


def migrate_db(path):
    conn = sqlite3.connect(path)
    try:
        if not table_exists(conn, "types"):
            raise RuntimeError("Missing types table.")
        if not table_exists(conn, "db_version"):
            raise RuntimeError("Missing db_version table.")
        migrate_requirements(conn)
        conn.execute(
            "INSERT INTO db_version (key, value) VALUES ('db_version', '1.1') "
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
        )
        conn.commit()
    finally:
        conn.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: migrate_db_1_1.py <path-to-ReqDB> [more paths...]")
        return 2
    for raw in sys.argv[1:]:
        path = Path(raw)
        if not path.exists():
            print(f"Missing file: {path}")
            continue
        try:
            migrate_db(path)
            print(f"Updated {path}")
        except Exception as exc:  # noqa: BLE001
            print(f"Failed {path}: {exc}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
