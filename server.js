const fs = require("fs");
const http = require("http");
const path = require("path");
const url = require("url");
const { app, dialog } = require("electron");
const Database = require("better-sqlite3");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function utcNow() {
  return new Date().toISOString();
}

function getAppDir() {
  if (app.isPackaged) {
    return app.getAppPath();
  }
  return __dirname;
}

function getDataDir() {
  const base = app.getPath("userData");
  return path.join(base, "requirements");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function loadSchema(db) {
  const schemaPath = path.join(getAppDir(), "schema.sql");
  const schema = fs.readFileSync(schemaPath, "utf-8");
  db.exec(schema);
}

function openDb(dbPath, options = {}) {
  const db = new Database(dbPath);
  db.exec("PRAGMA foreign_keys = ON;");
  loadSchema(db);
  migrateDb(db);
  if (options.resetDefaults) {
    resetDefaults(db);
  } else {
    seedStatuses(db);
    seedTypes(db);
    ensureDbVersion(db);
  }
  return db;
}

function resetDefaults(db) {
  db.prepare("DELETE FROM requirements;").run();
  db.prepare("DELETE FROM statuses;").run();
  db.prepare("DELETE FROM types;").run();
  db.prepare("DELETE FROM db_version;").run();
  seedStatuses(db);
  seedTypes(db);
  ensureDbVersion(db);
}

function seedStatuses(db) {
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM statuses;").get().cnt;
  if (count) return;
  const stmt = db.prepare(
    "INSERT INTO statuses (id, name, color, order_index) VALUES (?, ?, ?, ?);"
  );
  const statuses = [
    [1, "Draft", "#9aa2b1", 0],
    [2, "Proposed", "#7b8cff", 1],
    [3, "Approved", "#3f8cff", 2],
    [4, "In-Progress", "#f2b01e", 3],
    [5, "Verified", "#2e7d32", 4],
    [6, "Deferred", "#b00020", 5],
  ];
  statuses.forEach((row) => stmt.run(...row));
}

function seedTypes(db) {
  const count = db.prepare("SELECT COUNT(*) AS cnt FROM types;").get().cnt;
  if (count) return;
  const stmt = db.prepare(
    "INSERT INTO types (id, type_code, name, color, icon, order_index) VALUES (?, ?, ?, ?, ?, ?);"
  );
  const types = [
    [1, "CORE", "Core", "#b00020", "flag", 0],
    [2, "F", "Functional", "#1976d2", "chip", 1],
    [3, "M", "Mechanical", "#388e3c", "ruler", 2],
  ];
  types.forEach((row) => stmt.run(...row));
}

function tableExists(db, name) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?;")
    .get(name);
  return !!row;
}

function columnExists(db, table, column) {
  const rows = db.prepare(`PRAGMA table_info(${table});`).all();
  return rows.some((row) => row.name === column);
}

function migrateRequirementsTable(db) {
  if (!tableExists(db, "requirements")) return;
  if (columnExists(db, "requirements", "type_id")) return;
  if (!columnExists(db, "requirements", "type_code")) return;
  db.prepare("ALTER TABLE requirements RENAME TO requirements_old;").run();
  db.exec(
    "CREATE TABLE requirements (" +
      "id INTEGER PRIMARY KEY, " +
      "type_id INTEGER NOT NULL, " +
      "num_path TEXT NOT NULL, " +
      "display_code TEXT, " +
      "title TEXT NOT NULL, " +
      "description_md TEXT NOT NULL, " +
      "rationale_md TEXT, " +
      "parent_id INTEGER, " +
      "order_index INTEGER NOT NULL DEFAULT 0, " +
      "status_id INTEGER NOT NULL, " +
      "source TEXT, " +
      "created_at TEXT NOT NULL, " +
      "updated_at TEXT NOT NULL, " +
      "FOREIGN KEY (parent_id) REFERENCES requirements(id) ON DELETE CASCADE, " +
      "FOREIGN KEY (status_id) REFERENCES statuses(id), " +
      "FOREIGN KEY (type_id) REFERENCES types(id)" +
      ");"
  );
  db.exec(
    "INSERT INTO requirements (id, type_id, num_path, display_code, title, description_md, rationale_md, parent_id, order_index, status_id, source, created_at, updated_at) " +
      "SELECT r.id, t.id, r.num_path, r.display_code, r.title, r.description_md, r.rationale_md, r.parent_id, r.order_index, r.status_id, r.source, r.created_at, r.updated_at " +
      "FROM requirements_old r JOIN types t ON t.type_code = r.type_code;"
  );
  db.exec("DROP TABLE requirements_old;");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_req_type_num ON requirements(type_id, num_path);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_req_parent_order ON requirements(parent_id, order_index);");
  db.exec("CREATE INDEX IF NOT EXISTS idx_req_status ON requirements(status_id);");
}

function migrateDb(db) {
  if (tableExists(db, "settings") && !tableExists(db, "db_version")) {
    db.prepare("ALTER TABLE settings RENAME TO db_version;").run();
  }
  if (!tableExists(db, "db_version")) {
    db.prepare("CREATE TABLE IF NOT EXISTS db_version (key TEXT PRIMARY KEY, value TEXT);").run();
  }
  migrateRequirementsTable(db);
  ensureDbVersion(db);
}

function ensureDbVersion(db) {
  const row = db
    .prepare("SELECT value FROM db_version WHERE key = 'db_version';")
    .get();
  if (!row) {
    db.prepare("INSERT INTO db_version (key, value) VALUES ('db_version', '1.1');").run();
    return true;
  }
  return row.value === "1.1";
}

function checkDbVersion(db) {
  if (!tableExists(db, "db_version")) return false;
  const row = db
    .prepare("SELECT value FROM db_version WHERE key = 'db_version';")
    .get();
  if (!row) return false;
  return row.value === "1.1";
}

function getConfigPath() {
  const configDir = path.join(app.getPath("home"), ".config", "ReqTracker");
  fs.mkdirSync(configDir, { recursive: true });
  return path.join(configDir, "settings.json");
}

function readConfig() {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(data) {
  const configPath = getConfigPath();
  const tmpPath = `${configPath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data));
  fs.renameSync(tmpPath, configPath);
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildExportHtml(rows, version, theme) {
  const reqs = rows.map((r) => ({ ...r }));
  const code = (r) => `${r.type_code}${r.num_path}`;
  const codes = new Set(reqs.map(code));
  const byId = new Map(reqs.map((r) => [r.id, r]));
  const children = {};
  reqs.forEach((r) => {
    const key = r.parent_id ?? "root";
    if (!children[key]) children[key] = [];
    children[key].push(r);
  });
  Object.values(children).forEach((list) =>
    list.sort((a, b) => a.order_index - b.order_index)
  );

  const now = new Date().toString();
  const isDark = theme === "dark";
  const bg = isDark ? "#141821" : "#f6f7fb";
  const panel = isDark ? "#1f2430" : "#ffffff";
  const text = isDark ? "#e9edf5" : "#1f2430";
  const muted = isDark ? "#a0a7b4" : "#6b7280";
  const preview = isDark ? "#171c25" : "#f6f7fb";
  const css = `
    body { font-family: Arial, sans-serif; margin: 20px; background: ${bg}; color: ${text}; }
    .snapshot { font-weight: 700; margin-bottom: 16px; }
    .controls { margin-bottom: 12px; display: flex; gap: 8px; }
    .controls button { padding: 6px 10px; border-radius: 6px; border: 1px solid #cbd2e1; background: #fff; cursor: pointer; transition: background 0.2s ease, transform 0.1s ease; }
    .controls button:active { background: #e4ecf7; transform: translateY(1px); }
    .node { background: ${panel}; border-radius: 8px; padding: 12px; margin-bottom: 10px; }
    .code { font-weight: 700; }
    .dbid { color: #9aa2b1; margin-left: 8px; }
    .status { display: inline-block; padding: 2px 8px; border-radius: 999px; color: #fff; font-size: 11px; margin-left: 8px; }
    .meta { color: ${muted}; font-size: 12px; margin: 6px 0; }
    details > summary { cursor: pointer; list-style: none; }
    .title { font-size: 16px; margin: 6px 0; }
    .section-label { font-weight: 600; margin-top: 8px; }
    .content { margin-top: 4px; white-space: pre-wrap; background: ${preview}; padding: 6px; border-radius: 6px; }
    a.req-link { color: #2a7fbd; text-decoration: none; font-weight: 600; }
    a.req-link:hover { color: #1f5f8f; text-decoration: underline; }
  `;

  const anchorFor = (value) => `req-${value.replace(/\./g, "-")}`;
  const linkify = (text) => {
    const escaped = escapeHtml(text || "");
    return escaped.replace(/\b(CORE\d+|[A-Z]+\d+(?:\.\d+)*)\b/g, (m) => {
      if (codes.has(m)) return `<a class="req-link" href="#${anchorFor(m)}">${m}</a>`;
      return m;
    });
  };

  const renderReq = (req) => {
    const reqCode = code(req);
    const display = req.display_code || "";
    const label = display ? `${display} (${reqCode})` : reqCode;
    const parent = byId.get(req.parent_id);
    const parentCode = parent ? code(parent) : null;
    const parentLabel = parentCode
      ? `<a class="req-link" href="#${anchorFor(parentCode)}">${parentCode}</a>`
      : "none";
    const statusColor = req.status_color || "#9aa2b1";
    return `
<div class="node" id="${anchorFor(reqCode)}">
  <div><span class="code">${label}</span><span class="dbid">#${req.id}</span>
    <span class="status" style="background:${statusColor}">${req.status_name || "Unknown"}</span>
  </div>
  <div class="meta">Type: ${req.type_code} | Number: ${req.num_path} | Parent: ${parentLabel}</div>
  <div class="title">${escapeHtml(req.title || "")}</div>
  <div class="section-label">Description</div>
  <div class="content">${linkify(req.description_md)}</div>
  <div class="section-label">Rationale</div>
  <div class="content">${linkify(req.rationale_md)}</div>
</div>`;
  };

  const renderTree = (parentId, depth = 0) => {
    const key = parentId ?? "root";
    const items = children[key] || [];
    let html = "";
    const pad = depth * 16;
    items.forEach((r) => {
      if (children[r.id] && children[r.id].length) {
        html += `<div style="margin-left:${pad}px"><details open><summary>${renderReq(
          r
        )}</summary>${renderTree(r.id, depth + 1)}</details></div>`;
      } else {
        html += `<div style="margin-left:${pad}px">${renderReq(r)}</div>`;
      }
    });
    return html;
  };

  const body = renderTree(null, 0);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Requirements Snapshot</title>
  <style>${css}</style>
</head>
<body>
  <div class="snapshot">Snapshot | ${now} | Version ${escapeHtml(version)}</div>
  <div class="controls">
    <button type="button" onclick="expandAll()">Expand All</button>
    <button type="button" onclick="collapseAll()">Collapse All</button>
  </div>
  ${body}
  <script>
    function expandAll() {
      document.querySelectorAll('details').forEach(d => d.open = true);
    }
    function collapseAll() {
      document.querySelectorAll('details').forEach(d => d.open = false);
    }
  </script>
</body>
</html>`;
}

function parseBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve(Buffer.alloc(0));
      resolve(Buffer.concat(chunks));
    });
  });
}

function parseJson(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        resolve({});
      }
    });
  });
}

function startServer() {
  const appDir = getAppDir();
  const dataDir = getDataDir();
  ensureDir(dataDir);
  const dbPath = path.join(dataDir, "requirements.db");

let db = openDb(dbPath, { resetDefaults: true });
let currentDbPath = "";

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);
    if (parsed.pathname.startsWith("/api/")) {
      if (req.method === "GET" && parsed.pathname === "/api/requirements") {
        const rows = db
          .prepare(
            "SELECT r.*, s.name AS status_name, s.color AS status_color, " +
              "t.type_code AS type_code, t.name AS type_name " +
              "FROM requirements r " +
              "LEFT JOIN statuses s ON r.status_id = s.id " +
              "LEFT JOIN types t ON r.type_id = t.id " +
              "ORDER BY r.parent_id, r.order_index;"
          )
          .all();
        return json(res, { requirements: rows });
      }
      if (req.method === "GET" && parsed.pathname === "/api/settings") {
        return json(res, { error: "Use /api/db_version or /api/theme." }, 404);
      }
      if (req.method === "GET" && parsed.pathname === "/api/db_version") {
        const rows = db.prepare("SELECT key, value FROM db_version;").all();
        const values = {};
        rows.forEach((row) => {
          values[row.key] = row.value;
        });
        return json(res, { db_version: values });
      }
      if (req.method === "GET" && parsed.pathname === "/api/theme") {
        const config = readConfig();
        return json(res, { theme: config.theme || "light" });
      }
      if (req.method === "GET" && parsed.pathname === "/api/statuses") {
        const rows = db
          .prepare("SELECT * FROM statuses ORDER BY order_index;")
          .all();
        return json(res, { statuses: rows });
      }
      if (req.method === "GET" && parsed.pathname === "/api/types") {
        const rows = db
          .prepare("SELECT * FROM types ORDER BY order_index;")
          .all();
        return json(res, { types: rows });
      }
      if (req.method === "GET" && parsed.pathname === "/api/export") {
        const version = parsed.query.version || "";
        const theme = parsed.query.theme || "light";
        if (!version) return json(res, { error: "version is required." }, 400);
        const rows = db
          .prepare(
            "SELECT r.*, s.name AS status_name, s.color AS status_color, " +
              "t.type_code AS type_code, t.name AS type_name " +
              "FROM requirements r " +
              "LEFT JOIN statuses s ON r.status_id = s.id " +
              "LEFT JOIN types t ON r.type_id = t.id " +
              "ORDER BY r.parent_id, r.order_index;"
          )
          .all();
        const html = buildExportHtml(rows, version, theme);
        return send(res, html, "text/html; charset=utf-8");
      }
      if (req.method === "GET" && parsed.pathname === "/api/db/export") {
        const data = fs.readFileSync(dbPath);
        return send(
          res,
          data,
          "application/octet-stream",
          "attachment; filename=requirements.ReqDB"
        );
      }
      if (req.method === "POST" && parsed.pathname === "/api/requirements") {
        const body = await parseJson(req);
        const override = !!body.override;
        if (!body.type_id) return json(res, { error: "type_id is required." }, 400);
        let numPath = body.num_path;
        if (!numPath) {
          numPath = computeNextNumPath(db, body.type_id, body.parent_id);
        } else if (!override) {
          return json(res, { error: "Override mode required to set num_path." }, 403);
        }
        const stmt = db.prepare(
          "INSERT INTO requirements (type_id, num_path, display_code, title, description_md, rationale_md, parent_id, order_index, status_id, source, created_at, updated_at) " +
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);"
        );
        const info = stmt.run(
          body.type_id,
          numPath,
          body.display_code || null,
          body.title || "",
          body.description_md || "",
          body.rationale_md || null,
          body.parent_id ?? null,
          body.order_index || 0,
          body.status_id || 1,
          body.source || null,
          utcNow(),
          utcNow()
        );
        return json(res, { id: info.lastInsertRowid }, 201);
      }
      if (
        req.method === "POST" &&
        /^\/api\/requirements\/\d+\/reorder$/.test(parsed.pathname)
      ) {
        const body = await parseJson(req);
        const direction = body.direction;
        const id = Number(parsed.pathname.split("/")[3]);
        if (!["up", "down"].includes(direction)) {
          return json(res, { error: "direction must be 'up' or 'down'." }, 400);
        }
        const reqRow = db
          .prepare("SELECT * FROM requirements WHERE id = ?;")
          .get(id);
        if (!reqRow) return json(res, { error: "Requirement not found." }, 400);
        const siblings = db
          .prepare(
            "SELECT id, order_index FROM requirements WHERE parent_id IS ? ORDER BY order_index;"
          )
          .all(reqRow.parent_id ?? null);
        const idx = siblings.findIndex((s) => s.id === id);
        const swapIdx = direction === "up" ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= siblings.length) {
          return json(res, { ok: true });
        }
        const a = siblings[idx];
        const b = siblings[swapIdx];
        db.prepare("UPDATE requirements SET order_index = ?, updated_at = ? WHERE id = ?;")
          .run(b.order_index, utcNow(), a.id);
        db.prepare("UPDATE requirements SET order_index = ?, updated_at = ? WHERE id = ?;")
          .run(a.order_index, utcNow(), b.id);
        return json(res, { ok: true });
      }
      if (req.method === "POST" && parsed.pathname === "/api/statuses") {
        const body = await parseJson(req);
        if (!body.name) return json(res, { error: "name is required." }, 400);
        const info = db
          .prepare("INSERT INTO statuses (name, color, order_index) VALUES (?, ?, ?);")
          .run(body.name, body.color || null, body.order_index || 0);
        return json(res, { id: info.lastInsertRowid }, 201);
      }
      if (req.method === "POST" && parsed.pathname === "/api/types") {
        const body = await parseJson(req);
        if (!body.override) return json(res, { error: "Override required." }, 403);
        if (!body.type_code || !body.name)
          return json(res, { error: "type_code and name required." }, 400);
        const info = db
          .prepare(
            "INSERT INTO types (type_code, name, color, icon, order_index) VALUES (?, ?, ?, ?, ?);"
          )
          .run(
            body.type_code,
            body.name,
            body.color || null,
            body.icon || null,
            body.order_index || 0
          );
        return json(res, { id: info.lastInsertRowid }, 201);
      }
      if (req.method === "POST" && parsed.pathname === "/api/db/import") {
        const body = await parseBody(req);
        if (!body || !body.length) return json(res, { error: "No database data." }, 400);
        if (body.slice(0, 15).toString() !== "SQLite format 3") {
          return json(res, { error: "Invalid SQLite file." }, 400);
        }
        const nameHeader = req.headers["x-db-name"];
        if (nameHeader && !/\.reqdb$/i.test(nameHeader)) {
          return json(res, { error: "Only .ReqDB files are supported." }, 400);
        }
        const tmpPath = `${dbPath}.import`;
        fs.writeFileSync(tmpPath, body);
        let tmpDb;
        try {
          tmpDb = new Database(tmpPath);
          if (!checkDbVersion(tmpDb)) {
            tmpDb.close();
            fs.unlinkSync(tmpPath);
            return json(res, { error: "Incompatible DB version or file format." }, 400);
          }
          tmpDb.close();
        } catch (err) {
          if (tmpDb) tmpDb.close();
          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
          return json(res, { error: "Incompatible DB version or file format." }, 400);
        }
        currentDbPath = req.headers["x-db-path"] || "";
        db.close();
        fs.renameSync(tmpPath, dbPath);
        db = openDb(dbPath);
        return json(res, { ok: true });
      }
      if (req.method === "POST" && parsed.pathname === "/api/db/save") {
        if (!currentDbPath) {
          return json(res, { error: "No source database selected." }, 400);
        }
        const target =
          currentDbPath.endsWith(".ReqDB") || currentDbPath.endsWith(".reqdb")
            ? currentDbPath
            : `${currentDbPath}.ReqDB`;
        fs.copyFileSync(dbPath, target);
        return json(res, { ok: true });
      }
      if (req.method === "POST" && parsed.pathname === "/api/db/save-as") {
        const result = await dialog.showSaveDialog({
          title: "Save Requirements Database",
          defaultPath: currentDbPath || "requirements.ReqDB",
          filters: [{ name: "ReqDB", extensions: ["ReqDB", "reqdb"] }],
        });
        if (result.canceled || !result.filePath) {
          return json(res, { cancelled: true });
        }
        const target = result.filePath.match(/\.reqdb$/i)
          ? result.filePath
          : `${result.filePath}.ReqDB`;
        fs.copyFileSync(dbPath, target);
        currentDbPath = target;
        return json(res, { ok: true, path: target, name: path.basename(target) });
      }
      if (req.method === "POST" && parsed.pathname === "/api/db/new") {
        resetDefaults(db);
        currentDbPath = "";
        return json(res, { ok: true });
      }
      if (req.method === "PUT" && /^\/api\/requirements\/\d+$/.test(parsed.pathname)) {
        const body = await parseJson(req);
        const override = !!body.override;
        const id = Number(parsed.pathname.split("/")[3]);
        const reqRow = db
          .prepare("SELECT * FROM requirements WHERE id = ?;")
          .get(id);
        if (!reqRow) return json(res, { error: "Requirement not found." }, 400);
        const updates = {};
        const protectedFields = new Set(["type_id", "num_path", "parent_id"]);
        [
          "type_id",
          "num_path",
          "display_code",
          "title",
          "description_md",
          "rationale_md",
          "parent_id",
          "order_index",
          "status_id",
          "source",
        ].forEach((field) => {
          if (field in body) {
            if (protectedFields.has(field) && !override) {
              throw new Error("Override mode required for this change.");
            }
            updates[field] = body[field];
          }
        });
        if (Object.keys(updates).length) {
          updates.updated_at = utcNow();
          const keys = Object.keys(updates);
          const setClause = keys.map((k) => `${k} = ?`).join(", ");
          db.prepare(`UPDATE requirements SET ${setClause} WHERE id = ?;`).run(
            ...keys.map((k) => updates[k]),
            id
          );
        }
        return json(res, { ok: true });
      }
      if (req.method === "PUT" && parsed.pathname === "/api/db_version") {
        const body = await parseJson(req);
        const updates = {};
        if (body.db_version && typeof body.db_version === "object") {
          Object.assign(updates, body.db_version);
        }
        if (body.key && "value" in body) {
          updates[body.key] = body.value;
        }
        const keys = Object.keys(updates);
        if (!keys.length) return json(res, { ok: true });
        const stmt = db.prepare(
          "INSERT INTO db_version (key, value) VALUES (?, ?) " +
            "ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
        );
        keys.forEach((key) => {
          stmt.run(key, String(updates[key]));
        });
        return json(res, { ok: true });
      }
      if (req.method === "PUT" && parsed.pathname === "/api/theme") {
        const body = await parseJson(req);
        if (!body.theme) return json(res, { error: "theme is required." }, 400);
        const config = readConfig();
        config.theme = body.theme;
        writeConfig(config);
        return json(res, { ok: true });
      }
      if (req.method === "PUT" && /^\/api\/statuses\/\d+$/.test(parsed.pathname)) {
        const body = await parseJson(req);
        const id = Number(parsed.pathname.split("/")[3]);
        const updates = {};
        ["name", "color", "order_index"].forEach((field) => {
          if (field in body) updates[field] = body[field];
        });
        if (Object.keys(updates).length) {
          const keys = Object.keys(updates);
          const setClause = keys.map((k) => `${k} = ?`).join(", ");
          db.prepare(`UPDATE statuses SET ${setClause} WHERE id = ?;`).run(
            ...keys.map((k) => updates[k]),
            id
          );
        }
        return json(res, { ok: true });
      }
      if (req.method === "PUT" && /^\/api\/types\/\d+$/.test(parsed.pathname)) {
        const body = await parseJson(req);
        if (!body.override) return json(res, { error: "Override required." }, 403);
        const id = Number(parsed.pathname.split("/")[3]);
        const updates = {};
        ["type_code", "name", "color", "icon", "order_index"].forEach((field) => {
          if (field in body) updates[field] = body[field];
        });
        if (Object.keys(updates).length) {
          const keys = Object.keys(updates);
          const setClause = keys.map((k) => `${k} = ?`).join(", ");
          db.prepare(`UPDATE types SET ${setClause} WHERE id = ?;`).run(
            ...keys.map((k) => updates[k]),
            id
          );
        }
        return json(res, { ok: true });
      }
      if (req.method === "DELETE" && /^\/api\/requirements\/\d+$/.test(parsed.pathname)) {
        const id = Number(parsed.pathname.split("/")[3]);
        db.prepare("DELETE FROM requirements WHERE id = ?;").run(id);
        return json(res, { ok: true });
      }
      if (req.method === "DELETE" && /^\/api\/statuses\/\d+$/.test(parsed.pathname)) {
        const id = Number(parsed.pathname.split("/")[3]);
        const used = db
          .prepare("SELECT COUNT(*) AS cnt FROM requirements WHERE status_id = ?;")
          .get(id).cnt;
        if (used) return json(res, { error: "Status is in use." }, 400);
        db.prepare("DELETE FROM statuses WHERE id = ?;").run(id);
        return json(res, { ok: true });
      }
      if (req.method === "DELETE" && /^\/api\/types\/\d+$/.test(parsed.pathname)) {
        const body = await parseJson(req);
        if (!body.override) return json(res, { error: "Override required." }, 403);
        const id = Number(parsed.pathname.split("/")[3]);
        const typeRow = db
          .prepare("SELECT id FROM types WHERE id = ?;")
          .get(id);
        if (!typeRow) return json(res, { error: "Type not found." }, 400);
        const used = db
          .prepare("SELECT COUNT(*) AS cnt FROM requirements WHERE type_id = ?;")
          .get(id).cnt;
        if (used) return json(res, { error: "Type is in use." }, 400);
        db.prepare("DELETE FROM types WHERE id = ?;").run(id);
        return json(res, { ok: true });
      }
      return json(res, { error: "Not found." }, 404);
    }

    serveStatic(req, res, appDir);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ port: addr.port, close: () => server.close() });
    });
  });
}

function computeNextNumPath(db, typeId, parentId) {
  let rows;
  let base = "";
  if (parentId == null) {
    rows = db
      .prepare("SELECT num_path FROM requirements WHERE parent_id IS NULL AND type_id = ?;")
      .all(typeId);
  } else {
    const parent = db
      .prepare("SELECT num_path FROM requirements WHERE id = ?;")
      .get(parentId);
    if (!parent) throw new Error("Parent not found.");
    base = parent.num_path;
    rows = db
      .prepare("SELECT num_path FROM requirements WHERE parent_id = ? AND type_id = ?;")
      .all(parentId, typeId);
  }
  let maxSeg = -1;
  rows.forEach((r) => {
    const parts = String(r.num_path).split(".");
    const seg = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(seg)) maxSeg = Math.max(maxSeg, seg);
  });
  const nextSeg = maxSeg + 1;
  return base ? `${base}.${nextSeg}` : `${nextSeg}`;
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function send(res, data, contentType, disposition) {
  const headers = {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(data),
  };
  if (disposition) headers["Content-Disposition"] = disposition;
  res.writeHead(200, headers);
  res.end(data);
}

function serveStatic(req, res, appDir) {
  const parsed = url.parse(req.url);
  const safePath = parsed.pathname === "/" ? "/index.html" : parsed.pathname;
  const filePath = path.join(appDir, safePath);
  if (!filePath.startsWith(appDir)) {
    return json(res, { error: "Forbidden." }, 403);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return json(res, { error: "Not found." }, 404);
  }
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    "Content-Type": type,
    "Content-Length": data.length,
  });
  res.end(data);
}

module.exports = { startServer };
