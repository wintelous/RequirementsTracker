# Requirements Tracker (Electron)

Local requirements tracking tool for hierarchical requirements with statuses, types,
and versioned snapshots. Data is stored in a `.ReqDB` SQLite file and edited via a
buffer DB with explicit Save/Load.

## Run (Development)
```bash
cd <repo_folder>
npm install
npm run dev
```

## Build (Release)
```bash
cd <repo_folder>
npm install
npm run build
```
Artifacts are written to `<repo_folder>/dist/`.

## Usage
1. **New** starts a blank buffer DB (default statuses/types/db_version).
2. **Load** imports a `.ReqDB` file into the buffer DB.
3. **Save** writes back to the current file; if none, it opens Save As.
4. **Save As...** writes a new `.ReqDB` and sets it as the current file.
5. **Snapshot** exports a single-file HTML snapshot.

Override mode is required to edit type, number path, or parent.

## Settings Storage
- Theme is stored at `~/.config/ReqTracker/settings.json`.

## Database Migration (v1.1)
If you have older `.ReqDB` files (v1.0), run:
```bash
python3 scripts/migrate_db_1_1.py /path/to/file.ReqDB
```

## Project Files
- App entry: `main.js`
- Backend: `server.js`
- UI: `index.html`, `styles.css`, `app.js`
- DB schema: `schema.sql`

## Screenshots
![Example 1](https://github.com/wintelous/RequirementsTracker/blob/main/_images/req_example1.png?raw=true)
- Example 1 loaded (mobile app workflow), showing tree view, details pane, and top toolbar.

![Example 2](https://github.com/wintelous/RequirementsTracker/blob/main/_images/req_example2.png?raw=true)
- Example 2 loaded (SBC platform), showing deeper hierarchy and status badges.

![Edit Dialog](https://github.com/wintelous/RequirementsTracker/blob/main/_images/req_edit.png?raw=true)
- Requirement edit dialog with markdown description/rationale and live previews.

![Settings](https://github.com/wintelous/RequirementsTracker/blob/main/_images/settings.png?raw=true)
- Settings dialog.
