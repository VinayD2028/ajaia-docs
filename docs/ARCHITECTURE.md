# Architecture note

## What I prioritized (and why)

The brief asks for depth in a few areas over breadth. I put effort, in order, into: (1) a **correct access model**
(owner / edit / view / none) enforced on the server for every route, (2) an **editor that keeps its formatting**
across save, reload and import, (3) **verification** (unit tests on the logic, a smoke script on the HTTP layer,
browser checks of the real flows), and (4) a **deployable container**. I cut real authentication, real-time
collaboration and rich import fidelity on purpose (see Tradeoffs).

## Stack

Next.js 16 (App Router) + TypeScript strict + Tailwind v4; TipTap v3 (ProseMirror) editor; Postgres
(`pg` in production, embedded PGlite for local dev and tests); Vitest. One deployable unit: pages and API routes live in the same Next.js app, so there is no
CORS, no second service, and one Dockerfile.

## Data model

```
users(id, name, email UNIQUE)
documents(id, owner_id -> users, title, content_json, created_at, updated_at)
document_shares(document_id -> documents ON DELETE CASCADE, user_id -> users,
                permission CHECK IN ('view','edit'), PRIMARY KEY(document_id, user_id))
```

`content_json` is the TipTap/ProseMirror JSON document. JSON (not HTML) means no sanitizing on read, structure is
queryable if needed, and the same schema can validate input from the editor, the API and the importer. The DB is
opened lazily (a globalThis singleton) so `next build` never touches the filesystem; migrations are idempotent
`CREATE TABLE IF NOT EXISTS`, and the seed uses fixed ids with `INSERT OR IGNORE`.

## Access model

`getAccess(db, docId, userId)` returns `owner | edit | view | null` and is the single source of truth. It takes the
db as a parameter, so it is unit-tested against a real in-process Postgres (PGlite). Rules: no access -> **404** (not 403) so ids are not
leaked; view-only writes -> 403; only the owner can delete or manage shares. Sharing is by email with an upsert,
so re-sharing updates the permission. The permission is also checked in the UI (read-only editor, hidden toolbar and
Share button), but the server is what enforces it.

## Rich text consistency

A single `editorExtensions` list (TipTap StarterKit) is used by the browser editor **and** by the importer.
Import converts `.txt` (paragraphs/hard breaks), `.md` (marked) and `.docx` (mammoth) to HTML and then to JSON through
that schema, so anything the editor cannot render is dropped rather than stored (this is also why markdown `<script>`
never reaches the database). Size and shape are validated before every write (`validateContent`).

## Autosave

The editor debounces 800 ms after the last change, sends the whole document as JSON, and shows Saving / Saved /
Save failed. A failed save stays dirty and retries on the next change; pending edits are flushed on unmount and
`beforeunload` with `keepalive`. Whole-document saves are simple and robust at this scale.

## Testing strategy

- **Unit (61 tests):** access, shares, documents, validation and import, using real Postgres (PGlite in memory; also run against a real server) rather than
  mocks. I checked the tests can fail by temporarily breaking three behaviors and confirming they were caught.
- **HTTP smoke script (54 checks):** status codes, cookies, sharing and import end to end against a running server.
  Route handlers need the Next.js runtime (`cookies()`), so I chose this over mocking `next/headers`.
- **Browser checks:** headless Chrome flows (create/format/rename/refresh, two-user sharing, import). These were run
  during development and are not committed as automated tests.

## Deployment

Multi-stage Dockerfile (Node 22, non-root, `output: 'standalone'`, `/api/health` healthcheck) deployed to Render's free
plan via `render.yaml`. **Persistence:** the free web plan has no persistent disk, so the app stores data in a free Neon Postgres database
(`DATABASE_URL` is set by hand in the Render dashboard, so no secret lives in git). Data survives sleep, restarts and
redeploys; I checked this on the live site with a restart. The history: the first version used SQLite on the ephemeral
disk and lost data; I then moved to Render's free Postgres, but Render deletes free databases 30 days after creation,
so I switched to Neon, whose free plan has no expiry. The code did not change for that: it only needs a `postgres://` URL.
Locally the same dialect runs via embedded PGlite, so tests exercise real SQL. Neon's free plan keeps only a short
restore window and no real backups, so a long-lived deployment would still need its own backup routine.

## Tradeoffs and deliberate scope cuts

| Cut | Why | Cost |
|---|---|---|
| Mock auth (seeded users, unsigned `uid` cookie) | Brief allows it; keeps focus on sharing logic | Anyone can impersonate anyone |
| Optimistic version check on save (no merge) | Real-time/OT/CRDT is out of a 4-hour scope | A second editor gets a "changed elsewhere, reload" message and must copy their edit by hand; no live cursors or auto-merge |
| Whole-doc autosave | Simple and reliable | Larger payloads on long docs |
| docx import: text, headings, bold/italic/underline, lists only | Covers the common case | Tables/images dropped |
| Free Neon Postgres | No paid dependency, no expiry | Compute sleeps when idle; no real backups on the free plan |

## Concurrency and data-safety rules (added after QA)

- `documents.version` increments on every content save. The editor sends `baseVersion`; the server applies the
  update only if it still matches (`UPDATE ... WHERE version = $n`), otherwise returns **409**. The editor then
  stops autosaving and shows a reload banner instead of silently overwriting.
- The editor re-reads the document on mount, on `pageshow` (browser Back/Forward) and when the tab becomes visible,
  and applies it if the user has no unsaved edits. This fixed a stale-page bug that blanked the editor.
- One save is in flight at a time; failed saves retry every 3 s (network/5xx) and on the browser `online` event.
- Content is validated against the real TipTap schema (unknown nodes/marks rejected), depth-limited (40), link
  protocols limited to http(s)/mailto/tel, and NUL characters are rejected in titles, emails and ids.
- Imports are capped at 20,000 paragraphs/elements and must be valid UTF-8 text (binary/UTF-16 rejected).

## Security notes

This is a demo. The `uid` cookie is an unsigned user id, so **it is not authentication**: do not put real data in it.
Mitigations that do exist: parameterized queries everywhere, server-side permission checks on every route, input
validation with size limits, httpOnly + SameSite=Lax (+ Secure in production) cookie, import goes through the editor
schema. Not implemented: CSRF tokens, rate limiting, audit logs, signed sessions.

## What I would build next (2-4 hours)

1. Real auth (email magic link or OAuth) with signed sessions; 2. durable hosted database; 3. real-time sync/merge
(Yjs or similar) and presence indicators; 4. export to Markdown/PDF;
5. version history using the existing `updated_at` + a `document_versions` table; 6. committed Playwright tests for
the browser flows.
