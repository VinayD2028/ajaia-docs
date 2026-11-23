# AI Process Log

**Assignment:** Ajaia "AI-Native Full Stack Developer Assignment" (lightweight collaborative document editor)
**Start time:** Mon 2026-11-23 12:45 ET (240-minute limit, hard stop 16:45)
**Tools used:** Claude (Sonnet 5.5) in two roles: (1) prompt engineer that wrote each prompt and this log, and (2) the coding agent that executed the prompts in a cloud Linux sandbox (switched at ~12:49 when I asked Claude to run the prompts directly instead of pasting them into another tool). Headless Google Chrome driven by Playwright for UI checks; `curl` smoke script; Vitest.
**Honesty note:** because the same assistant wrote and executed the prompts, "prompt iteration" in this log is mostly about fixing issues found by verification, not about rewriting prompts after seeing weak output. Timestamps are taken from my message times and the clock tool; end times are not recorded per prompt.

---

### [#1] [P0 Scaffold] [start 12:48 / 3 min elapsed]
**Goal:** Scaffold Next.js + SQLite schema, seed, mock auth, user switcher.
**Prompt:**
````text
ROLE
You are a senior full-stack engineer pairing with me on a 4-hour timeboxed build. Optimize for a working, deployable slice over breadth.

CONTEXT
We are building a lightweight collaborative document editor (Google Docs-inspired) for an internal-productivity-tools exercise. Core features: create/rename/edit rich-text docs, upload .txt/.md/.docx to create a doc, share docs between users (owner vs. shared), persistence, validation, one automated test, free deployment. Reviewers must be able to log in as seeded users to test sharing.

STACK (fixed, do not substitute)
- Next.js (App Router) + TypeScript, strict mode
- SQLite via better-sqlite3 (file at ./data/app.db, path configurable by DATABASE_PATH env var)
- Tailwind CSS for styling
- Editor will be TipTap (installed later, not in this task)
- Vitest for tests (installed later)
- Auth: mocked. Seeded users, a user switcher, identity stored in an httpOnly cookie. No passwords.

TASK (this step only: scaffold and data layer)
1. Initialize the Next.js project with the stack above.
2. Create src/lib/db.ts: opens SQLite, runs migrations on startup (idempotent), exports a typed singleton.
3. Schema:
   - users(id TEXT PK, name TEXT, email TEXT UNIQUE)
   - documents(id TEXT PK, owner_id TEXT FK, title TEXT NOT NULL, content_json TEXT NOT NULL, created_at, updated_at)
   - document_shares(document_id FK, user_id FK, permission TEXT CHECK IN ('view','edit'), PRIMARY KEY(document_id, user_id))
   Store editor content as TipTap JSON (content_json).
4. Create src/lib/seed.ts: idempotently seeds 3 users (Alice, Bob, Carol, with emails) plus one sample doc owned by Alice and shared with Bob.
5. Create src/lib/auth.ts: getCurrentUser() reads the cookie; returns null if absent or unknown.
6. Add POST /api/session (set cookie by user id, validate it exists) and GET /api/users (list seeded users).
7. Minimal home page with a user switcher dropdown that calls /api/session and shows the current user.

CONSTRAINTS
- No extra dependencies beyond the stack above.
- Use parameterized queries only.
- Keep files small and single-purpose. No premature abstractions.
- Do not build document CRUD, the editor, upload or sharing yet.

OUTPUT FORMAT
1. A short list of files created or changed.
2. Exact commands to install, run and verify.
3. Any assumption you made that I should review.

ACCEPTANCE CRITERIA
- `npm run dev` starts with no errors; the DB file is created and seeded on first run; a second run does not duplicate seed data.
- GET /api/users returns 3 users.
- Switching users in the UI persists across refresh via the cookie.
- `npx tsc --noEmit` passes.
````
**Result:** Next.js 16 app (TS strict, Tailwind v4), better-sqlite3 schema + idempotent seed (Alice, Bob, Carol, 1 shared sample doc), `getCurrentUser()`, `POST /api/session`, `GET /api/users`, user-switcher page. All acceptance criteria passed.
**Issues / Verification:**
- Verified by running: `/api/users` returns 3 users; restart leaves 3 users / 1 doc / 1 share (seed idempotent); cookie is httpOnly; unknown user -> 404, bad JSON -> 400; `tsc --noEmit` and `next build` pass.
- **Template problem:** `create-next-app` generated `cacheComponents` and `partialPrefetching` flags in `next.config.ts`. Experimental, and they force Suspense handling around `cookies()`. I removed both and added `serverExternalPackages: ["better-sqlite3"]`.
- **Build failure:** `next/font/google` could not fetch fonts at build time (restricted network). Replaced with a system font stack (also removes a deploy-time network dependency).
- My own shell line wrote a file before its directory existed; harmless, the fallback created it.
- **Missed instruction (found at ~13:14):** the template's `AGENTS.md` says to read the bundled Next.js docs (`node_modules/next/dist/docs/`) before writing code because this version has breaking changes. I did not do that up front, and I had filtered build output with `grep`. After the fact I re-ran the full build (no warnings) and confirmed in the bundled docs that `dynamic = "force-dynamic"` (used on every route) is supported with Cache Components off.
**Iteration:** none (prompt accepted as written; fixes were applied to the output).
**Decision / Tradeoff:** SQLite file DB + Docker deploy instead of Vercel + Supabase: fastest to build and no external account, at the cost of an ephemeral disk on free hosts (mitigated by seeding on boot; revisited in #7). Removed experimental Next flags for stability.

### [#2] [P1 Document API] [start 12:54 / 9 min elapsed]
**Goal:** Document CRUD API with access checks and validation (no UI).
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing the Ajaia Docs build (Next.js App Router + TS strict, better-sqlite3, mocked cookie auth already in place: see src/lib/db.ts, auth.ts, seed.ts).

TASK (this step only: document API + access logic, no UI)
1. src/lib/access.ts: getAccess(db, docId, userId) -> 'owner' | 'edit' | 'view' | null. Pure function, takes the db as a parameter so it is unit-testable with openDatabase(':memory:').
2. src/lib/documents.ts: listDocuments(db, userId) returning { owned: [...], shared: [...] } where each item has id, title, updated_at, owner name, and for shared docs the permission. createDocument, getDocument, renameDocument, saveContent, deleteDocument (owner only).
3. Routes:
   - GET /api/documents -> { owned, shared }
   - POST /api/documents { title? } -> creates an empty TipTap doc ({type:'doc',content:[{type:'paragraph'}]}), default title 'Untitled document'
   - GET /api/documents/[id] -> doc + { access }
   - PATCH /api/documents/[id] { title?, content? } -> title needs edit access or owner; content needs edit access or owner
   - DELETE /api/documents/[id] -> owner only
4. Validation: title trimmed, 1-200 chars; content must be an object with type === 'doc' and serialized size <= 1 MB; reject unknown fields. Return JSON { error } with 400/401/403/404 as appropriate. Return 404 (not 403) when the user has no access at all so doc ids are not leaked. 401 when no cookie user.
5. Update updated_at on every successful PATCH.

CONSTRAINTS
- Parameterized queries only. Next 16: route params are async (await params). No new dependencies.
- Keep validation in a small src/lib/validate.ts, no schema library.

OUTPUT FORMAT
Files changed list, then a curl script (as a code block) exercising: create as Alice, view as Carol (expect 404), view as Bob (expect 200, edit), PATCH as Bob, DELETE as Bob (expect 403).

ACCEPTANCE CRITERIA
- All curl cases return the expected status codes; run them and show the actual output.
- tsc --noEmit and next build pass.
````
**Result:** `access.ts`, `documents.ts`, `validate.ts`, `http.ts` helpers and routes `GET/POST /api/documents`, `GET/PATCH/DELETE /api/documents/[id]`. Smoke script `scripts/api-smoke.sh` ran 21/21 passing.
**Issues / Verification:**
- Verified status codes with curl: 401 without cookie, 404 for users with no access (ids not leaked), 403 for view-only writes and non-owner delete, 400 for empty title, bad content, unknown field, empty patch, invalid JSON.
- PATCH validates everything before writing anything, so a bad request cannot half-apply.
- **Deviation from prompt:** the prompt asked to test "view as Bob, expect 200" on an Alice-created doc, but sharing did not exist yet. I used the seeded `d_sample` doc (already shared with Bob) instead.
- The 1 MB content limit was implemented but not exercised over HTTP; covered later by a unit test in #6.
**Iteration:** none. The unavoidable gap (cannot share a new doc yet) was closed in #4.
**Decision / Tradeoff:** Return 404 instead of 403 when the user has no access at all, to avoid leaking which document ids exist (specified in the prompt; I agreed with it).

### [#3] [P2 Editor UI] [start 12:56 / 11 min elapsed]
**Goal:** Dashboard (owned vs shared) and TipTap editor with toolbar, rename, autosave, view-only mode.
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing Ajaia Docs (Next.js 16 App Router, TS strict, Tailwind v4, mocked cookie auth, document API already built and verified: GET/POST /api/documents, GET/PATCH/DELETE /api/documents/[id]).

TASK (UI only: dashboard + editor; do NOT build sharing or upload UI yet)
1. Install: @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline (starter-kit v3 may already bundle underline: check the installed version's docs/exports and avoid registering it twice).
2. Home page (/): if no user, show the user switcher only. If signed in, show a dashboard with a "New document" button (POSTs, then navigates to /docs/[id]) and two clearly labelled sections: "My documents" and "Shared with me". Shared rows show owner name and a "Can edit" / "Can view" badge. Empty states for each section.
3. /docs/[id] page (server component loads doc + access; 404 via notFound() when null; redirect to / if signed out). Pass to a client Editor component.
4. Editor component: TipTap with StarterKit + Underline. Toolbar: Bold, Italic, Underline, H1, H2, H3, paragraph, bullet list, ordered list, with active-state highlighting and aria-labels. Editable title input (rename on blur/Enter, validates non-empty, reverts on error).
5. Autosave: debounce 800 ms after content change; PATCH {content}; show a status text: "Saving…", "Saved", or "Save failed: <message>" with retry on next change. Flush pending save on unmount/beforeunload. View-only users: editor non-editable, toolbar hidden, "View only" badge, title read-only.
6. Header with back link to dashboard and the user switcher.

CONSTRAINTS
- Tailwind only, no component library. Set `immediatelyRender: false` in useEditor to avoid SSR hydration errors. Style the prose (headings, lists) with a small CSS block in globals.css since the typography plugin is not installed.
- Keep components in src/components, one concern per file.

OUTPUT FORMAT
Files changed; manual test script (numbered steps) I can click through.

ACCEPTANCE CRITERIA
- Create doc, type, apply every format, rename, refresh: all content and formatting persist.
- Bob sees d_sample under "Shared with me" and can edit; Carol gets a 404 page for it.
- tsc and next build pass; no hydration warnings in the console.
````
**Result:** Dashboard with 'My documents' / 'Shared with me' + badges, `/docs/[id]` page, `Editor`, `Toolbar`, `Header`, `not-found`, prose CSS. Autosave debounce 800 ms with Saving/Saved/Failed status; view-only mode hides toolbar.
**Issues / Verification:**
- **Check before coding:** StarterKit v3 already bundles Underline (confirmed in its type definitions), so I uninstalled the separate `@tiptap/extension-underline` to avoid registering it twice.
- **Real bug (caught by `tsc`):** a redundant `readOnly={readOnly && access !== "edit"}` on the title input; removed (`disabled` already covers view-only).
- **UX bug found from a screenshot:** the red title error stayed after the title reverted; now cleared on the next keystroke.
- Verified in headless Chrome (Playwright): every format (H1, bold, italic, underline, bullet, numbered) persists after refresh; rename persists; empty rename reverts with an inline error; Bob sees `d_sample` under Shared and can edit; Carol gets a 404 page; signed-out user is redirected; no console warnings or hydration errors.
- Not testable yet: view-only mode (needs sharing). Tested in #4.
**Iteration:** none for the prompt; three code fixes above.

### [#4] [P3 Sharing] [start ~12:58 / 13 min elapsed]
**Goal:** Owner-only sharing API + share dialog + 'Shared with N' badge.
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing Ajaia Docs (Next.js 16 App Router, TS strict, Tailwind v4, mocked cookie auth, SQLite). Document CRUD API, access.ts (getAccess -> owner|edit|view|null) and the TipTap editor UI already exist and are verified.

TASK (sharing: API + UI)
1. src/lib/shares.ts (takes db as a parameter, unit-testable): listShares(db, docId) -> [{user_id, name, email, permission}], upsertShare(db, docId, userId, permission), removeShare(db, docId, userId), findUserByEmail(db, email) (case-insensitive, trimmed).
2. Routes (owner-only; 404 if no access, 403 if not owner):
   - GET /api/documents/[id]/shares -> { shares }
   - POST /api/documents/[id]/shares { email, permission: 'view'|'edit' } -> upsert (re-sharing updates the permission). Errors: 400 invalid email/permission/unknown fields, 404 'No user with that email', 400 'You already own this document' when sharing with self.
   - DELETE /api/documents/[id]/shares/[userId] -> removes access.
3. UI: a "Share" button in the editor header, visible to the owner only, opening an accessible modal (role=dialog, Escape closes, focus moves in). Contents: email input with a <datalist> of the other seeded users' emails, permission select (Can edit / Can view), Add button, list of current collaborators each with a permission dropdown (changes immediately) and Remove button, inline error/success messages.
4. Dashboard: on owned docs, show a small "Shared with N" badge when N > 0.
5. Extend scripts/api-smoke.sh with sharing cases: alice shares her new doc with bob (edit) -> bob PATCH 200; downgrade to view -> bob PATCH 403 and GET access=view; carol (no share) 404; bob cannot POST shares (403); unknown email 404; self-share 400; remove -> bob 404.

CONSTRAINTS
- Parameterized queries only; no new dependencies; reuse err/handleError/readJsonObject helpers in src/lib/http.ts and validators style in src/lib/validate.ts.
- listDocuments must expose a share_count for owned docs without N+1 queries.

OUTPUT FORMAT
Files changed; the extended smoke script run output.

ACCEPTANCE CRITERIA
- Smoke script passes fully. In a real browser: Alice shares with Bob as view, Bob sees 'Can view' badge and a read-only editor with no toolbar; Alice upgrades to edit, Bob (after refresh) can edit.
- tsc and next build pass; no console errors.
````
**Result:** `shares.ts`, `/api/documents/[id]/shares` (GET, POST upsert) and `/shares/[userId]` (DELETE, PATCH), `ShareDialog` (accessible modal, email datalist, per-user permission dropdown, remove), share_count on owned docs. Smoke script extended; 46/46 passing.
**Issues / Verification:**
- Verified view/edit downgrade and upgrade over HTTP (Bob PATCH 200 -> 403 after downgrade; access=view), Carol still 404, non-owner gets 403, unknown email 404, self-share 400, bad email/permission/unknown field 400, remove then 404.
- Verified in headless Chrome with two users: Alice shares as view; Bob sees 'Can view', read-only editor, no toolbar, title disabled, no Share button; Alice upgrades to edit and Bob (after refresh) can edit; Alice sees Bob's edit; after removal Bob gets 404. Escape closes the dialog; focus lands in the email field.
- **Deviation:** I added `PATCH /shares/[userId]`, which the prompt did not list, to implement 'dropdown changes immediately' cleanly.
- **Side effect found while reviewing output:** my smoke script's PATCH cases permanently renamed the seeded `d_sample` doc ('Edited by Bob'), which would corrupt demo data on a reviewer's DB. Added a restore step; re-verified the seed doc is intact.
- The two browser console 'errors' were the browser logging the 404s I triggered on purpose (unknown email; Bob after removal).
**Iteration:** Prompt #5 and later scripts must leave seeded data untouched.
**Decision / Tradeoff:** Permission model is per-document view/edit (not just on/off) because the schema already supported it and it makes the sharing demo clearer.

### [#5] [P4 File import] [start 13:00 / 15 min elapsed]
**Goal:** Import .txt / .md / .docx into a new editable doc.
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing Ajaia Docs (Next.js 16 App Router, TS strict, Tailwind v4, SQLite, TipTap v3 StarterKit). Dashboard, editor, document API and sharing are done and verified.

TASK (file upload -> new editable document)
1. Feature: user imports a .txt, .md or .docx file and gets a NEW document (owned by them) with the content converted into TipTap JSON, then is taken to the editor.
2. Dependencies allowed (and only these): mammoth (docx -> HTML), marked (markdown -> HTML), @tiptap/html (HTML -> TipTap JSON, use the server entry point that works in Node without a browser DOM; check the installed version's exports before importing).
3. src/lib/import.ts: pure function importFile(name: string, bytes: Buffer): Promise<{ title: string; content: object }>.
   - Extension whitelist: .txt, .md, .docx (case-insensitive); anything else -> ValidationError listing supported types.
   - Max 2 MB, non-empty, otherwise ValidationError.
   - .txt: paragraphs split on blank lines; single newlines become hard breaks. No HTML interpretation.
   - .md: marked -> HTML -> JSON. .docx: verify the 'PK' zip signature first, mammoth.convertToHtml -> JSON. Corrupt docx -> friendly ValidationError (not a 500).
   - HTML -> JSON must use the SAME extensions as the editor (StarterKit) so unsupported markup is dropped by the schema; never store raw HTML.
   - Title = filename without extension, trimmed, truncated to 200 chars; fallback 'Imported document'.
   - Result content must pass validateContent (<= 1 MB serialized).
4. POST /api/documents/import (multipart/form-data, field 'file'): requires a user (401), 400 if no file / wrong field, returns 201 { id }. Reuse createDocument.
5. UI: on the dashboard add an 'Import file' button (hidden <input type=file accept='.txt,.md,.docx'>) plus visible helper text 'Supported: .txt, .md, .docx (max 2 MB)'. Show a busy state, inline error on failure, navigate to /docs/[id] on success.
6. Fixtures in tests/fixtures: sample.txt, sample.md (heading, bold, italic, bullet list, numbered list), and generate sample.docx programmatically with a small script (documented) containing a heading, bold and a list.

CONSTRAINTS
- Strict TS, no `any`. Keep conversion code isolated in src/lib/import.ts so it is unit-testable without HTTP.
- next.config: add the new Node-only packages to serverExternalPackages if the build requires it.

OUTPUT FORMAT
Files changed; curl/smoke output for: txt, md, docx, wrong extension, empty file, oversize file, corrupt docx, no cookie.

ACCEPTANCE CRITERIA
- Each valid fixture imports into a doc whose JSON contains the expected node types (heading, bold mark, bulletList/orderedList).
- Every invalid case returns 400 (or 401) with a clear message, never 500.
- In a real browser: import sample.md, see formatting in the editor, refresh, still there.
- tsc and next build pass; no console errors.
````
**Result:** `import.ts` (mammoth, marked, `@tiptap/html/server`), `POST /api/documents/import`, 'Import file' button with visible supported-types text, fixtures for txt/md/docx. All invalid cases returned a clear 4xx, never 500.
**Issues / Verification:**
- Verified fixtures produce expected nodes (heading, bold, italic, bullet/ordered lists); markdown `<script>` is dropped by the editor schema; `.txt` keeps `<b>` as literal text; UI shows inline error for a `.pdf`; browser: imported `.md` keeps formatting after refresh.
- **Real bug that the acceptance criteria did not catch:** the `.docx` import silently lost underlined text. I found it by inspecting the stored JSON (no `mark:underline`). mammoth ignores underline unless mapped; fixed with `styleMap: ["u => u"]`. A regression test was added in #6.
- **My own bug:** my edit put a comment in the middle of an expression, commenting out `).value;` and breaking compilation (server returned empty responses). Fixed by moving the comment.
- My first inspection script matched the wrong titles (all imported docs are titled by filename minus extension), so it printed nothing; rewrote it to look up by id.
- **Deviation:** oversize files return 413, not 400 (more accurate HTTP semantics).
- Used a fixture generator script (`scripts/make-docx-fixture.py`) because the docx fixture must be a real file.
**Iteration:** none for the prompt; mutation test added in #6 to protect the underline fix.
**Decision / Tradeoff:** Convert everything through the editor's own schema (same extension list as the editor) instead of storing HTML: safer (unsupported markup dropped) and guarantees imports only produce what the editor can render. Rejected: attaching the file to the doc without conversion (less useful for the workflow).

### [#6] [P5 Tests] [start 13:02 / 17 min elapsed]
**Goal:** Automated tests for access, shares, documents, validation and import.
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing Ajaia Docs. All features (documents, editor, sharing, import) work and were verified manually/with curl. Now add meaningful automated tests.

TASK
1. Install Vitest (devDependency only) with a vitest.config.ts: node environment, '@' alias to ./src, include 'tests/**/*.test.ts'. Add npm scripts: "test": "vitest run", "test:smoke": "bash scripts/api-smoke.sh".
2. Write tests that use a fresh in-memory DB per test via openDatabase(':memory:') (no mocking of SQLite):
   - tests/access.test.ts: owner / edit / view / null for a stranger / null for an unknown doc id; permission change takes effect; removing a share revokes access.
   - tests/shares.test.ts: upsert is idempotent and updates permission; removeShare returns false when nothing removed; findUserByEmail is case-insensitive and trims.
   - tests/documents.test.ts: listDocuments splits owned vs shared; share_count is correct; deleting a document cascades its shares; seed() is idempotent (calling twice does not duplicate rows).
   - tests/validate.test.ts: title trim and 1-200 bounds; content must be {type:'doc'}; >1 MB content rejected; rejectUnknownFields; validateEmail/validatePermission.
   - tests/import.test.ts: sample.txt, sample.md, sample.docx fixtures produce the expected node/mark types (heading, bold, italic, underline for docx, bulletList, orderedList); markdown <script> is dropped; txt keeps '<b>' as literal text; rejects wrong extension, empty file, >2 MB, a non-zip .docx and a corrupt zip .docx with ValidationError.
3. Tests must assert behavior and meaningful edge cases, not just that functions run. No snapshot tests.
4. Also extend scripts/api-smoke.sh with import cases using tests/fixtures (txt/md/docx -> 201, bad extension -> 400, no cookie -> 401) and delete the created docs at the end.

CONSTRAINTS
- Do not import src/lib/auth.ts or anything from next/headers in tests (it needs the Next runtime). HTTP behavior stays covered by the smoke script; state this limitation in a comment at the top of the smoke script.
- If a test fails, fix the CODE if it is a real bug; do not weaken the assertion.

OUTPUT FORMAT
Files changed; full `npm test` output; list of any real bugs the tests uncovered.

ACCEPTANCE CRITERIA
- `npm test` passes; running it twice gives the same result.
- Mutation sanity check: temporarily break getAccess (e.g. return 'edit' for everyone) and confirm at least one test fails, then revert.
- tsc and next build still pass.
````
**Result:** 43 Vitest tests in 5 files using a fresh in-memory SQLite per test; smoke script extended with import cases (54/54). `npm test` passes twice with identical results.
**Issues / Verification:**
- **Dependency conflict:** `vitest@5` needs `@types/node` 22+ but the template pinned 20 (ERESOLVE). Aligned `@types/node` to 22 (matches the Node 22 runtime) instead of using `--legacy-peer-deps`.
- All 43 tests passed on the first run, which proves little, so I ran the prompt's mutation check with three mutations: `getAccess` returning 'edit' for strangers (4 tests failed), removing the docx underline mapping (1 failed), replacing the share upsert with INSERT OR IGNORE (2 failed). All reverted; 43/43 pass again.
- `tsc` caught a type error in my own test file (Vitest does not typecheck); then eslint flagged an unused param; both fixed.
- Config warning about ESM in `vitest.config.ts`; renamed to `.mts`.
- The smoke script's `Usage:` comment line got uncommented by my edit; fixed.
- Honest note: the tests did not uncover any real application bug; their value here is regression protection (notably the underline fix).
- Limitation: Next route handlers are not unit-tested (they need the Next runtime for `cookies()`), so the HTTP layer is covered by `scripts/api-smoke.sh`; stated in the script header.
**Iteration:** none for the prompt.
**Decision / Tradeoff:** Test the logic under the routes (access, shares, import, validation) with real SQLite in memory, and cover HTTP with a smoke script, rather than mocking `next/headers`. Rejected: heavy route-handler mocking, which would test the mocks.

### [#7] [P6 Deploy readiness] [start ~13:05 / 20 min elapsed]
**Goal:** Make the app deployable on a free host: standalone output, health check, Dockerfile, render.yaml.
**Prompt:**
````text
ROLE
Senior full-stack engineer / DevOps pairing on Ajaia Docs (Next.js 16, better-sqlite3 native module, SQLite file DB, Node 22). All features and tests are done. Make the app deployable on a free host (target: Render free web service via Docker) without changing app behavior.

TASK (deployment readiness only)
1. next.config.ts: output 'standalone' (keep serverExternalPackages for better-sqlite3 so the native binding is traced into the standalone output).
2. GET /api/health -> 200 { ok: true, db: true } after running a trivial SELECT 1 through the real DB singleton; 503 { ok: false } if the DB cannot be opened. No auth required. Never expose paths or error details.
3. Dockerfile (multi-stage, node:22-slim or bookworm-slim): deps -> build -> runner. Runner runs as a non-root user, sets NODE_ENV=production, PORT (default 3000), HOSTNAME=0.0.0.0, DATABASE_PATH=/app/data/app.db, creates /app/data owned by that user, copies .next/standalone, .next/static and public, runs `node server.js`. Include a HEALTHCHECK that curls/wgets /api/health. Image must not contain tests, fixtures, .git or a local data/ directory.
4. .dockerignore (node_modules, .next, data, .git, tests, e2e artifacts, *.log, .env*).
5. render.yaml: one web service, runtime docker, free plan, healthCheckPath /api/health, env DATABASE_PATH. No disk (free plan has none) and a comment that SQLite lives on ephemeral disk there and is reseeded on boot.
6. Make the seed demo data resilient to a cold start: confirm the DB is created and seeded on first request and on boot of a fresh container.

CONSTRAINTS
- No new runtime dependencies. Do not change business logic. Secure-cookie handling must still work behind a TLS-terminating proxy: verify `secure: NODE_ENV==='production'` cookies are set and accepted when the app is accessed through https at the host (Render terminates TLS) and also document that accessing the production build over plain http://localhost will not keep the login cookie.
- Pin the Node major version in the Dockerfile and in package.json `engines`.

OUTPUT FORMAT
Files changed; commands to build and run the image locally; the actual `docker build`/`docker run`/curl output demonstrating health, login cookie flow and persistence across a container restart WITH a volume mounted.

ACCEPTANCE CRITERIA
- `docker build` succeeds; container starts; /api/health returns 200; /api/users returns 3 seeded users.
- Data written by a user survives `docker restart` when /app/data is a volume, and is reseeded cleanly when it is not.
- Image runs as non-root.
````
**Result:** `output: 'standalone'`, `GET /api/health`, multi-stage non-root `Dockerfile`, `.dockerignore`, `render.yaml`, `engines` pin. Verified against an emulated clean Docker build (see below). **Not verified:** a real `docker build` and an actual host deploy (no Docker daemon in my sandbox; deploy needs the user's accounts).
**Issues / Verification:**
- **No Docker daemon available**, so I emulated the stages: copied the repo through the `.dockerignore` rules into an empty directory, ran `npm ci`, `npm run build`, copied the standalone output into a runner layout and ran `node server.js` with production env vars as a non-root user.
- **Real deploy-breaking bug found by that emulation:** `npm ci` failed because `better-sqlite3@13` ships prebuilt binaries but the lockfile lacks its `gypfile:false` flag, so npm falls back to `node-gyp rebuild`. On `node:22-bookworm-slim` (no python/make/g++) the Docker build would fail even with open internet. Fixed with `npm ci --ignore-scripts` in the Dockerfile; re-ran the emulation: build passes and the native binary is traced into the standalone output.
- Verified on the production build: `/api/health` 200, 3 seeded users, cookie has `Secure; HttpOnly; SameSite=lax`, data survives restart when the data dir persists, a wiped data dir reseeds cleanly, and the smoke script passes 54/54.
- **Wrong assumption in my prompt:** I wrote that the Secure cookie would not persist over `http://localhost`. I tested it in real Chrome and login persists (Chrome treats localhost as secure). README must say only that non-localhost plain-http hosts will not keep the cookie.
- **Open problem:** Render's free plan has an ephemeral disk, so SQLite data is lost whenever the instance sleeps or redeploys. Documents could vanish between a reviewer's visits.
**Iteration:** Asked the user (13:09). Answer: keep SQLite on Render free (ephemeral disk, documented) and deploy through the user's Chrome. Docs must state the ephemeral-disk limitation prominently.
**Decision / Tradeoff:** Chose (A) Render free + ephemeral SQLite over (B) Turso/libSQL (durable, but an async refactor of the data layer and an extra account) and (C) another host. Reason: simplest path that meets "no paid dependency"; cost: data created on the live site resets when the instance sleeps or redeploys. Documented in README, ARCHITECTURE and SUBMISSION.

### [#8] [P7 Documentation] [start ~13:13 / 28 min elapsed]
**Goal:** README, architecture note, AI workflow note, SUBMISSION.md, video placeholder + talk track, from the real repo state.
**Prompt:**
````text
ROLE
Technical writer + senior engineer finishing the Ajaia Docs submission. The code, tests and Docker setup are done. Write the reviewer-facing documents from the ACTUAL repository state: read the code and package.json, do not rely on memory.

TASK (documents only, no code changes)
1. README.md: what the product is, live URL placeholder, test accounts (and that there are no passwords), prerequisites (Node 22), exact local setup/run/test/lint/build commands copied from package.json, supported import types and limits, a short sharing demo script a reviewer can follow in 2 minutes, environment variables, Docker instructions, project structure, API summary table, known limitations. Every command must be one I have actually run, or be marked unverified.
2. docs/ARCHITECTURE.md (short): what was prioritized and why, stack and data model, access model, how rich text is stored and kept consistent between editor and importer, autosave strategy, testing strategy, deployment, deliberate scope cuts and tradeoffs, security notes (mock auth is not real auth: say so plainly), and what to build next.
3. docs/AI_WORKFLOW.md: which AI tools were used, where AI materially sped up the work, which AI output was changed or rejected (use real examples from AI_PROCESS_LOG.md only), how correctness/UX/reliability were verified. Be candid about the limits of the process. Where only the candidate can supply a fact (what they verified by hand), leave a clearly marked TODO instead of inventing it.
4. SUBMISSION.md: exact list of what is included, live URL and credentials, video link file, and the required partial-feature statement: what works, what is incomplete, what I would build next with 2-4 more hours.
5. WALKTHROUGH_VIDEO.txt placeholder containing a TODO for the video URL, plus docs/VIDEO_OUTLINE.md: a 4-minute talk track mapped to the required topics (main flow, what works end to end, what was deprioritized, key decisions, how AI helped).

CONSTRAINTS
- Plain, specific, no marketing language. Do not claim anything unverified (no 'production-ready', no 'real-time', no 'secure').
- State the ephemeral-disk limitation of the free host prominently.
- Keep README under ~150 lines and ARCHITECTURE under ~120 lines.

OUTPUT FORMAT
Files created; then a list of every claim in the docs that I (the candidate) must personally verify before submitting.

ACCEPTANCE CRITERIA
- A reviewer who has only the zip can run the app and the tests by following the README verbatim (verify by following it in a clean copy).
- No placeholder text remains except clearly marked TODOs for: live URL, video URL, candidate-only facts.
````
**Result:** `README.md` (105 lines), `docs/ARCHITECTURE.md` (91), `docs/AI_WORKFLOW.md`, `SUBMISSION.md`, `WALKTHROUGH_VIDEO.txt` (placeholder), `docs/VIDEO_OUTLINE.md`, 3 screenshots in `docs/screenshots/`. Remaining TODO markers are intentional (live URL, video URL, Drive link, candidate-only facts, Docker note).
**Issues / Verification:**
- Followed the README verbatim in a clean unzip of the project, as a reviewer would. **This found a second, reviewer-facing install bug:** a plain `npm install` (not just `npm ci`) also falls back to `node-gyp rebuild` for `better-sqlite3` when a lockfile is present, so the README as first written would fail on any machine without a C++ toolchain. Checked the lockfile: only `fsevents` (optional, macOS, prebuilt) has an install script, so I added a committed `.npmrc` with `ignore-scripts=true` and updated the README. Re-ran from a clean copy: install, 43 tests, lint, build, `npm start`, smoke script 54/54 all pass.
- Docs only claim what was run. Items marked unverified: `docker build` (no daemon here), live-site behavior, cross-browser.
- `docs/AI_WORKFLOW.md` uses only examples from this log and leaves a TODO for facts only the candidate can supply (what they personally checked).
**Iteration:** none for the prompt; the README and `.npmrc` were fixed from what the clean-copy run showed.
**Decision / Tradeoff:** Chose a repo-wide `.npmrc` (`ignore-scripts=true`) over documenting `npm install --ignore-scripts` in the README: a reviewer following any default command works, at the cost of disabling lifecycle scripts for all dependencies (acceptable here: only `fsevents` was affected). Rejected: pinning an older better-sqlite3 that has an install script, because it would add a network download step at install time.

### [#9] [P8 Deploy] [~13:17-13:40 / ~32-55 min elapsed]
**Goal:** Put the code on GitHub and deploy it to a free live URL (Render), then verify it live.
**Prompt:**
````text
No pre-written prompt: this step was driven interactively by the user's decisions rather than a single prompt. Instructions in effect:
- "I'll do it with Claude in Chrome": use the user's signed-in Chrome for GitHub and Render, and ask before each account-changing action.
- Keep SQLite on Render's free plan (ephemeral disk accepted and documented).
- Create a PUBLIC GitHub repo `ajaia-docs`; Claude uploads files through GitHub's web uploader.
- Deploy through a Render Blueprint (`render.yaml`), then verify health, the three-user sharing flow and the seeded data on the live URL.
````
**Result:** Public repo `VinayD2028/ajaia-docs` (70 files) and a free Docker web service on Render, live at https://ajaia-docs-eu0h.onrender.com. First build took 1 min 52 s. `/api/health` returns `{"ok":true,"db":true}`.
**Issues / Verification:**
- **Blocked, not worked around:** my request for access to the user's Documents folder was denied by the auto-mode classifier, so I stopped and asked. The user then connected a specific folder themselves. The Chrome upload tool still refused files that I had written into that connected folder ("only files this session is allowed to read"); I did not try to bypass it. The user has no `git` installed on Windows, so the user drag-and-dropped the files onto GitHub's upload page instead.
- GitHub's web uploader rejects hidden files, so I created `.npmrc`, `.dockerignore` and `.gitignore` through GitHub's editor (prefilled via URL). Before the user committed, I compared the uploader's file list with the project: 67 expected, 67 present, none missing or extra.
- One of my clicks missed the Render 'Deploy Blueprint' button because the page layout had shifted; nothing was created by the miss. I re-located the button by reference before the real click, after the user confirmed.
- **This was the real `docker build`** that I could not run in my sandbox; it succeeded on Render, which also confirms the `--ignore-scripts` fix in the Dockerfile.
- Live verification (JS calls from the live origin): 401 without cookie; create 201; PATCH 200; share with Bob (view) 201; Bob GET access=view; Bob PATCH 403; Bob's shared list correct; Carol 404; Alice upgrades Bob 200; Bob PATCH 200; cleanup DELETE 200; seeded doc present.
- **Bug found only on the live site, in the user's dark-mode Chrome:** the template's CSS switched to a dark page background with light text on dark-mode systems, but my cards use `bg-white`, so titles were nearly invisible. My headless Playwright tests all ran in light mode and could not catch it. Fixed by removing the `prefers-color-scheme: dark` block and setting `color-scheme: light`. Verified locally with a forced dark color scheme (dark text on white in both modes), committed through GitHub's editor (hash of the result matched my local file exactly), auto-deployed, and re-checked live in the same browser.
- Not verified: the live import UI (the Chrome tool cannot select local files for me); import was verified locally and by the smoke script. Only Chrome was used.
**Iteration:** docs updated with the live URL; the 'Docker build unverified' notes were removed because Render built the image.
**Decision / Tradeoff:** Public repo (simplest for Render, no extra GitHub permissions) over a private repo (hides source, needs authorizing Render's GitHub app). Used GitHub's web uploader (user drag-and-drop) over asking the user to install git. Accepted that auto-deploy from `main` resets the free instance's data on every commit.

---

### [#10] [P9 Persistence] [~13:44-13:55 / ~59-70 min elapsed]
**Goal:** Stop the live site from losing documents on sleep/redeploy (the ephemeral-disk tradeoff accepted in #9), without any secret the user must paste.
**Prompt:**
````text
ROLE
Senior full-stack engineer continuing Ajaia Docs (Next.js 16, TS strict). Everything works and is deployed on Render's free web service, but the SQLite file lives on an ephemeral disk, so user documents are lost whenever the instance sleeps or redeploys. Fix persistence WITHOUT adding any secret that a human must paste anywhere.

DECISION ALREADY MADE
Use Render's free Postgres, wired into the web service through the Blueprint (`databases:` + `fromDatabase` connection string). Use ONE SQL dialect everywhere: Postgres in production through `pg`, and PGlite (@electric-sql/pglite, in-process Postgres/WASM) when DATABASE_URL is not set (local dev, Docker with a volume, and all tests). Remove better-sqlite3.

TASK
1. src/lib/db.ts: define a small async interface `Db { query<T>(sql, params?): Promise<T[]>; exec(sql): Promise<void> }` with two implementations selected at runtime: `pg.Pool` when DATABASE_URL is set (SSL only when DATABASE_SSL=true), otherwise PGlite persisted at PGLITE_DIR (default ./data/pgdata) or in memory when the dir is 'memory://'. `openDatabase(target)` creates the schema (idempotent CREATE TABLE IF NOT EXISTS + a unique index on lower(email)) and seeds. `getDb()` returns a cached Promise<Db> on globalThis; if opening fails, clear the cache so the next call can retry. PGlite must be loaded with a dynamic import only on the no-DATABASE_URL path so production never loads it.
2. Port every SQL statement to Postgres ($1 placeholders, now(), ON CONFLICT, COUNT(*)::int, `RETURNING` instead of changes/rowCount). Keep the HTTP/API behaviour and JSON shapes IDENTICAL: timestamps must still be 'YYYY-MM-DD HH24:MI:SS' UTC strings (use to_char; remember ORDER BY must reference the qualified column, not the text alias).
3. Make all data-layer functions async (access, documents, shares, seed) and await them in every route handler, page and the health check. No behaviour changes to validation, status codes or the 404-not-403 rule.
4. Tests: convert to async; use ONE PGlite instance per test file (reset with TRUNCATE + reseed in beforeEach) so the suite stays fast. Keep every existing assertion; keep the DB-level CHECK constraint test. Add a test that the schema/seed is idempotent against a persisted PGlite directory (open twice, rows not duplicated, edits not overwritten).
5. Blueprint/Docker: render.yaml gets a free Postgres database and sets DATABASE_URL on the web service from it; remove the 'ephemeral disk' comment. Dockerfile no longer needs `--ignore-scripts` or the node-gyp explanation, and `.npmrc` is deleted. Update README, ARCHITECTURE, SUBMISSION and AI_WORKFLOW text that mentions SQLite/ephemeral data (state the 30-day free Postgres expiry honestly).

CONSTRAINTS
- No behaviour regressions: the existing 54-check smoke script must pass unchanged against the new backend, and all existing test cases must be preserved.
- Parameterized queries only. No new dependencies besides pg, @electric-sql/pglite, @types/pg.
- Do not weaken or delete a test to make it pass.

OUTPUT FORMAT
Files changed; test output; smoke-script output; a clean-copy run of the README steps; what could NOT be verified locally (e.g. real `pg` against Render's managed Postgres).

ACCEPTANCE CRITERIA
- `npm test`, `npm run lint`, `tsc --noEmit`, `next build` pass; smoke script 54/54 on the dev server and on `npm start`.
- Restarting the server keeps documents (PGlite dir), and a second `openDatabase` on the same dir does not duplicate seed data.
- The `pg` code path is exercised against a real Postgres server (install one locally or run `pg` against a throwaway Postgres in the sandbox) before deploy.
````
**Result:** Data layer ported to async Postgres: `pg` in production (Render free Postgres declared in `render.yaml`, `DATABASE_URL` injected by `fromDatabase`), embedded PGlite when `DATABASE_URL` is unset (local dev, tests). `better-sqlite3`, `.npmrc` and the `--ignore-scripts` workaround were removed. API JSON shapes and status codes unchanged.
**Issues / Verification:**
- Tests: 44 pass (43 ported + 1 new restart-persistence test on an on-disk PGlite dir). The same 16 access/shares/documents tests also pass against a real local Postgres 16 server through `pg` (`TEST_DATABASE_URL`).
- My ported test had a real bug (`await listDocuments(...).owned` reads a property of a Promise); tsc and the test run caught it, I fixed it.
- Smoke script 54/54 against (a) `next start` + real Postgres, (b) the standalone build from a clean unzip + real Postgres. Restart persistence checked on the standalone build with PGlite: my first attempt was invalid (the old server still held the port, so the second start failed with EADDRINUSE); I noticed from the log, redid it with a verified shutdown, and the document survived the restart.
- DB unreachable: `/api/health` returns 503 instead of crashing.
- Clean unzip: `npm ci` (no flags), tests, lint, build all pass.
- NOT verified: Render's managed Postgres itself (internal URL, whether TLS is required, free-tier behaviour); only a local server was used. `DATABASE_SSL=true` exists as a fallback. No Docker daemon in my sandbox, so the first real image build of this version happens on Render.
**Iteration:** README, ARCHITECTURE, SUBMISSION, AI_WORKFLOW and the video outline updated; the 30-day free Postgres expiry is stated openly.
**Decision / Tradeoff:** Render free Postgres over Turso: no account token for the user to paste and one `render.yaml`, but Render deletes free databases 30 days after creation (14-day grace). One dialect (Postgres via PGlite locally) over keeping SQLite locally, so tests exercise the production SQL. Cost: pushing this adds a database to the user's Render account, so I will ask before syncing.

---

### [#11] [P9 Persistence] [~14:00-14:30 / ~75-105 min elapsed]
**Goal:** Push the Postgres port live, then move the database off Render's free Postgres (deleted after 30 days) to Neon's free tier.
**Prompt:**
````text
No pre-written prompt: driven interactively by the user's decisions. Instructions in effect:
- "Push the postgres update first and then add neon."
- The user (not Claude) creates the Neon account/project and pastes the connection string into Render's `DATABASE_URL`; Claude never sees the secret.
- Verify on the live site, and ask before account-changing actions.
````
**Result:** Live site now uses a Neon Postgres database. `/api/health` OK; a document created on the live site survived a service restart (checked twice: once on Render's database, once on Neon). Neon's console showed the project's compute active right after my requests.
**Issues / Verification:**
- Push: my sandbox's GitHub token was invalid and Chrome upload of files from the connected folder was refused, so the user drag-and-dropped the 33 changed files; I deleted `.npmrc` through GitHub's editor. The repo then matched my local tree except a comment-only `.gitignore` change (hidden files can't be uploaded).
- The Blueprint auto-synced and created the Render database. The first deploy after the upload FAILED: the instance ran out of its 512 MB memory, because that build had no `DATABASE_URL` yet and fell back to the embedded database. The next deploy (with the database wired in) succeeded. Fix: production now refuses to start without `DATABASE_URL` unless `ALLOW_EMBEDDED_DB=true`; verified locally (503 with a clear log message without the flag, smoke 54/54 with it).
- Not verified: that the live data is in Neon rather than Render's database was inferred from the Neon console's recent compute activity, not from reading rows. The Render database `ajaia-db` still existed at this point and must be removed by the user once `render.yaml` is synced.
**Iteration:** `render.yaml` no longer declares a database; `DATABASE_URL` is `sync: false` (set by hand), `DATABASE_SSL=true`. Docs updated to say Neon and to state that the free plan has no real backups.
**Decision / Tradeoff:** Neon free (no expiry, no card) over Render free Postgres (30-day expiry) or a SQLite mirror (it would live on the same ephemeral disk). Cost: an extra account and a secret kept outside git; Neon compute sleeps when idle, and the free plan has only a short restore window.

---


### [#12] [QA + hardening] [14:28-14:52 ET, ~1h45m-2h07m elapsed]
- **Prompt (summary):** Run five adversarial QA trials (first-time user, hostile input, access control, file upload, chaos/concurrency), report confirmed vs suspected bugs without fixing; then "fix in the order you mentioned".
- **AI output:** Playwright/HTTP scripts (~300 checks), a severity-ranked report (10 findings), then fixes: import caps, content schema validation, NUL guards, version-checked saves with 409, editor refetch on Back/Forward, offline retry, share-dialog accessibility, mobile layout.
- **What I verified / what was wrong:** The first full run of my own scripts had harness mistakes (broken pipe, wrong history setup) that I corrected before counting anything; the Back/Forward root cause is still a likely, not proven, explanation. After the fixes: 61 unit tests, 54-check smoke script and 67 access-control checks pass, and the repro scripts for QA-001..010 pass against a rebuilt production build.
- **Open:** Not re-run against the live Render/Neon site; the new `version` column is added on startup via `ALTER TABLE ... IF NOT EXISTS`.


### [#13] [Auth] [14:56-15:25 ET, ~2h10m-2h40m elapsed]
- **Prompt (summary):** "tackle the sign-in issue: basic sign-in page; when logged in as one user they cannot access other users unless they sign out."
- **AI output:** Email + password sign-in (scrypt hashes, shared demo password for the three seeded users), HMAC-signed expiring session cookie replacing the bare `uid`, login/logout routes, 5-failure throttle, sign-in form and Sign out button replacing the user switcher, `/api/users` now requires sign-in; tests and smoke script updated.
- **What I verified / what was wrong:** 69 unit tests, 58-check smoke script, 67 access-control checks and 43 auth/UI checks pass on a rebuilt build. My first browser run failed because an old server was still bound to the port (stale build) and then because my own API test had throttled Carol; both were harness mistakes, fixed in the scripts, not the app.
- **Open:** Not run against the live site yet. The shared demo password is public in the README by design (reviewers need it). Throttle is per instance and in memory.

## Summary of AI Usage

- **Tools:** Claude (Sonnet 5.5) acted as prompt engineer, coding agent and process logger; headless Chrome (Playwright), Vitest, a bash smoke script, Claude in Chrome for GitHub, Render and Neon dashboards.
- **Decomposition:** small, single-layer prompts in dependency order (scaffold, API, editor UI, sharing, import, tests, deploy readiness, docs, persistence), each with acceptance criteria that were checked by running code, not by reading it.
- **Where the AI helped most:** the full vertical slice (schema, API, editor, sharing dialog, importer) in about the first half hour; breadth of tests (69 unit tests, a 58-check HTTP script, mutation checks, ~300 adversarial QA checks); browser flows for several users; a live data-layer port from SQLite to Postgres with checks against a real Postgres server.
- **Where verification mattered (real defects found by checking, not trusting):** `.docx` import silently dropped underlined text; the smoke script mutated seed data; `npm ci` tried to compile a native module and broke the Docker build; experimental template flags; a wrong cookie assumption in my own prompt; text unreadable in dark-mode browsers (found only on the live site); a ported test that read a property of a Promise; an out-of-memory deploy when the embedded database fallback ran without a `DATABASE_URL`; and, from the adversarial QA, a server-killing import, a Back/Forward data-loss bug, silent overwrites between two tabs, and weak content validation (all fixed and re-tested).
- **What I did by hand:** chose the tools and architecture tradeoffs (SQLite, then Postgres, then Neon, and rejecting a same-disk SQLite backup), created the Render, GitHub and Neon accounts' side of the setup, pasted the database secret myself, uploaded the code (no git on my PC) and verified the file counts, approved each deploy, and tried the live file import myself. I did not hand-write the application code and did not read every generated line; I relied on tests, scripts and live checks.
- **What I would do with more time:** real accounts (sign-up, per-user passwords or OAuth) instead of three seeded users with one demo password; real-time collaboration or merge (conflicts are now detected with a version check, not merged); Markdown/PDF export and version history; scheduled database backups kept outside the host (the free Neon plan has only a short restore window); table and image support in `.docx` import; browser-level automated tests in CI.
- **Honest limits:** the live app is a demo (seeded demo accounts with a shared password, free hosting that sleeps when idle). I have not yet recorded the walkthrough video or personally re-read the whole codebase.
