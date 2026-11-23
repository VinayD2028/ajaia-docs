# Architecture note

## What I prioritized (and why)

The brief asks for depth in a few areas over breadth. I put effort, in order, into: (1) a **correct access model**
(owner / edit / view / none) enforced on the server for every route, (2) an **editor that keeps its formatting**
across save, reload and import, (3) **verification** (unit tests on the logic, a smoke script on the HTTP layer,
browser checks of the real flows), and (4) a **deployable container**. I cut real authentication, real-time
collaboration and rich import fidelity on purpose (see Tradeoffs).

## Stack

Next.js 16 (App Router) + TypeScript strict + Tailwind v4; TipTap v3 (ProseMirror) editor; SQLite via
better-sqlite3; Vitest. One deployable unit: pages and API routes live in the same Next.js app, so there is no
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
db as a parameter, so it is unit-tested against in-memory SQLite. Rules: no access -> **404** (not 403) so ids are not
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

- **Unit (43 tests):** access, shares, documents, validation and import, using real SQLite (`:memory:`) rather than
  mocks. I checked the tests can fail by temporarily breaking three behaviors and confirming they were caught.
- **HTTP smoke script (54 checks):** status codes, cookies, sharing and import end to end against a running server.
  Route handlers need the Next.js runtime (`cookies()`), so I chose this over mocking `next/headers`.
- **Browser checks:** headless Chrome flows (create/format/rename/refresh, two-user sharing, import). These were run
  during development and are not committed as automated tests.

## Deployment

Multi-stage Dockerfile (Node 22, non-root, `output: 'standalone'`, `/api/health` healthcheck) deployed to Render's free
plan via `render.yaml`. **Ephemeral disk:** the free plan has no persistent volume, so SQLite data is lost on sleep or
redeploy and is reseeded on boot. I accepted this to stay within "no paid dependency" and keep setup simple. The Docker
volume instructions in the README show the persistent setup; a hosted database (for example libSQL/Turso or Postgres)
is the real fix.

## Tradeoffs and deliberate scope cuts

| Cut | Why | Cost |
|---|---|---|
| Mock auth (seeded users, unsigned `uid` cookie) | Brief allows it; keeps focus on sharing logic | Anyone can impersonate anyone |
| Last-write-wins saves | Real-time/OT/CRDT is out of a 4-hour scope | Concurrent editors can overwrite each other |
| Whole-doc autosave | Simple and reliable | Larger payloads on long docs |
| docx import: text, headings, bold/italic/underline, lists only | Covers the common case | Tables/images dropped |
| SQLite on an ephemeral disk | Free and zero-setup | Data resets on the live host |

## Security notes

This is a demo. The `uid` cookie is an unsigned user id, so **it is not authentication**: do not put real data in it.
Mitigations that do exist: parameterized queries everywhere, server-side permission checks on every route, input
validation with size limits, httpOnly + SameSite=Lax (+ Secure in production) cookie, import goes through the editor
schema. Not implemented: CSRF tokens, rate limiting, audit logs, signed sessions.

## What I would build next (2-4 hours)

1. Real auth (email magic link or OAuth) with signed sessions; 2. durable hosted database; 3. optimistic
concurrency (version number on save, conflict message) and presence indicators; 4. export to Markdown/PDF;
5. version history using the existing `updated_at` + a `document_versions` table; 6. committed Playwright tests for
the browser flows.
