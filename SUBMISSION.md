# Submission

## Links

- **Live product URL:** <!-- TODO(candidate): Render URL -->
- **Walkthrough video:** see `WALKTHROUGH_VIDEO.txt` <!-- TODO(candidate): record and paste the unlisted link there -->
- **Google Drive folder:** <!-- TODO(candidate): folder link -->

## Test accounts

No passwords. Choose a user from the dropdown: Alice (`alice@example.com`), Bob (`bob@example.com`),
Carol (`carol@example.com`). A sample document ("Welcome to Ajaia Docs") is owned by Alice and shared with Bob (can edit).
Note: on the live free host, documents you create are lost when the instance sleeps or redeploys; seeded data returns.

## What is included

| Path | Contents |
|---|---|
| `src/`, `tests/`, `scripts/`, `public/`, config files | Source code, 43 unit tests, HTTP smoke script, fixtures |
| `Dockerfile`, `.dockerignore`, `render.yaml` | Container and free-host deployment config |
| `README.md` | Local setup/run/test instructions, demo script, API summary, limitations |
| `docs/ARCHITECTURE.md` | Architecture and tradeoffs note |
| `docs/AI_WORKFLOW.md` | AI workflow note |
| `AI_PROCESS_LOG.md` | Prompts, iterations and process log |
| `docs/VIDEO_OUTLINE.md`, `WALKTHROUGH_VIDEO.txt` | Talk track and the video link file |
| `docs/screenshots/` | Editor, share dialog and import screenshots |
| `SUBMISSION.md` | This file |

`node_modules/`, `.next/` and `data/` are intentionally excluded.

## What works

Create, rename, edit (bold, italic, underline, H1-H3, bullet and numbered lists), autosave, save and reopen; import of
.txt/.md/.docx into a new document; owner-only sharing with view/edit permission and clear owned vs shared lists;
persistence of content and sharing in SQLite; validation and error handling; 43 passing unit tests and a 54-check HTTP
smoke script; production build and health check.

## What is incomplete

- Authentication is mocked (seeded users, unsigned cookie).
- Last write wins on concurrent edits; no real-time collaboration or presence.
- Live-site data is not durable (free host, ephemeral disk).
- `.docx` import drops tables and images; no document delete or export UI.
- `docker build` itself was not run in the author's sandbox (no Docker daemon); see README. <!-- TODO(candidate): remove once the Render build succeeds -->

## What I would build next with another 2-4 hours

Real auth with signed sessions; a durable hosted database; optimistic-concurrency saves with a conflict message and
presence indicators; Markdown/PDF export; version history; committed Playwright tests for the browser flows.
