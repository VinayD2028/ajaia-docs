# Ajaia Docs

A lightweight collaborative document editor (Google Docs-inspired): create, rename and edit rich-text
documents, import files, and share documents between users. Built for the Ajaia full-stack assignment.

- **Live app:** https://ajaia-docs-eu0h.onrender.com
- **Hosting note:** the web app runs on Render's free plan and stores data in a free Neon Postgres database, so
  documents survive sleep, restarts and redeploys. The first request after sleep (~15 min idle) can take about a
  minute, and Neon's compute also wakes from idle on first use.

## Test accounts (no passwords)

| User | Email |
|---|---|
| Alice | alice@example.com |
| Bob | bob@example.com |
| Carol | carol@example.com |

Pick a user from the dropdown (top right). This is **mock auth**, not real authentication: see
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#security-notes).

## 2-minute sharing demo

1. Sign in as **Alice**, click **New document**, type something, apply bold/heading/list formatting.
2. Click **Share**, add `bob@example.com` as **Can view**.
3. Switch to **Bob** (dropdown): the doc is under **Shared with me** with a *Can view* badge; the editor is read-only.
4. Back as Alice, change Bob to **Can edit**; refresh as Bob and edit. **Carol** gets a 404 for that document.
5. As Alice, click **Import file** and pick `tests/fixtures/sample.md` or `sample.docx`: it becomes a new editable document.

## Run locally

Prerequisite: **Node 22** (`engines` is pinned to 22.x). No database install and no C++ toolchain are needed: without
`DATABASE_URL` the app runs an embedded Postgres (PGlite, WASM) stored in `./data/pgdata`.

```bash
npm install
npm run dev          # http://localhost:3000 ; creates ./data/pgdata and seeds demo data on first request
```

| Command | What it does |
|---|---|
| `npm test` | 61 unit tests (Vitest, real Postgres via embedded PGlite; set `TEST_DATABASE_URL` to run them against a server) |
| `npm run test:smoke` | HTTP smoke script (needs a running server; `BASE=http://localhost:3000` by default) |
| `npm run lint` | ESLint |
| `npm run build && npm start` | Production build and server |

To reset all data, stop the server and delete the `data/` directory.

Environment variables: `DATABASE_URL` (a `postgres://` URL; required in production), `DATABASE_SSL=true` (if the server needs TLS, as Neon does), `ALLOW_EMBEDDED_DB=true` (production only: allow the embedded database), `PGLITE_DIR` (embedded database directory when `DATABASE_URL` is unset; default `./data/pgdata`), `PORT` (default 3000).

## Features

- **Editing:** TipTap editor with bold, italic, underline, H1-H3, bulleted and numbered lists; inline title rename;
  autosave 800 ms after typing (status shows Saving / Saved / Save failed).
- **Import:** `.txt`, `.md`, `.docx` (max 2 MB, UTF-8 text, up to 20,000 paragraphs) become a new document. Supported types are also shown in the UI.
  Conversion goes through the editor's schema, so unsupported markup (for example raw HTML or scripts) is dropped.
- **Sharing:** the owner can share by email with *view* or *edit* permission, change it, or remove access.
  Dashboard separates **My documents** (with "Shared with N") from **Shared with me** (with Can view / Can edit).
- **Persistence:** Postgres (managed in production, embedded PGlite locally); content is stored as TipTap JSON so formatting survives refresh.
- **Validation:** title 1-200 chars, content must be a doc object under 1 MB, unknown fields rejected,
  clear JSON errors (400/401/403/404), users with no access get 404 so document ids are not leaked.

## Docker

```bash
docker build -t ajaia-docs .
docker run -p 3000:3000 -v ajaia-data:/app/data -e ALLOW_EMBEDDED_DB=true ajaia-docs     # volume keeps the embedded Postgres data
# or: -e DATABASE_URL=postgres://user:pass@host:5432/db  to use an external Postgres
```

The Dockerfile is what the live site is built from. In production the login cookie is
`Secure`: it works over HTTPS and on `http://localhost` in Chrome, but not on other plain-HTTP hosts.

## Project structure

```
src/app/            pages (/, /docs/[id]) and API routes
src/app/api/        session, users, health, documents, documents/[id], .../shares, documents/import
src/components/     Dashboard, Editor, Toolbar, ShareDialog, Header, UserSwitcher
src/lib/            db, seed, auth, access, documents, shares, import, validate, extensions, http
tests/              unit tests + fixtures (sample.txt / .md / .docx)
scripts/            api-smoke.sh, make-docx-fixture.py
docs/               ARCHITECTURE.md, AI_WORKFLOW.md, VIDEO_OUTLINE.md, screenshots/
```

## API summary (all JSON; identity comes from the `uid` cookie)

| Route | Notes |
|---|---|
| `POST /api/session` `{userId}` | sign in as a seeded user |
| `GET /api/users`, `GET /api/health` | seeded users; liveness + DB check |
| `GET/POST /api/documents` | list `{owned, shared}`; create |
| `POST /api/documents/import` | multipart field `file` |
| `GET/PATCH/DELETE /api/documents/[id]` | PATCH `{title?, content?}` needs edit access; DELETE owner only |
| `GET/POST /api/documents/[id]/shares` | owner only; POST `{email, permission}` |
| `PATCH/DELETE /api/documents/[id]/shares/[userId]` | owner only |

## Known limitations

- Mock auth (see above); if two people edit the same document at once, the second saver gets a "changed elsewhere, reload" message (version check, no merge, no live cursors).
- Free-host data resets as described at the top; no password reset, no real accounts, no document deletion UI.
- Import keeps headings, bold/italic/underline and lists; tables and images in `.docx` are not preserved.
- Route handlers are covered by the smoke script, not by unit tests (they need the Next.js runtime).
