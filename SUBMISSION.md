# Submission

## Links

- **Live product URL:** https://ajaia-docs-eu0h.onrender.com (Render free plan; the first request after idle can take about a minute to wake)
- **Walkthrough video:** https://drive.google.com/file/d/18iQve-n8Xf1Mc4lqiNVpUsHJHrcL_BjB/view?usp=drive_link (also in `WALKTHROUGH_VIDEO.txt`)
- **Google Drive folder:** https://drive.google.com/drive/folders/1rAKKC8-T6a1B_gOV100O5zBZvRS-wcGx

## Test accounts

Sign in with Alice (`alice@example.com`), Bob (`bob@example.com`) or Carol (`carol@example.com`); the password
for all three is `ajaia-demo`. Use **Sign out** to switch user. A sample document ("Welcome to Ajaia Docs") is owned by Alice and shared with Bob (can edit).
Documents are stored in a hosted Neon Postgres database, so they survive restarts and redeploys.

## What is included

| Path | Contents |
|---|---|
| `src/`, `tests/`, `scripts/`, `public/`, config files | Source code, 69 unit tests, HTTP smoke script, fixtures |
| `Dockerfile`, `.dockerignore`, `render.yaml` | Container and free-host deployment config |
| `README.md` | Local setup/run/test instructions, demo script, API summary, limitations |
| `docs/ARCHITECTURE.md` | Architecture and tradeoffs note |
| `docs/AI_WORKFLOW.md` | AI workflow note |
| `AI_PROCESS_LOG.md` | Prompts, iterations and process log |
| `docs/VIDEO_OUTLINE.md`, `WALKTHROUGH_VIDEO.txt` | Talk track and the video link file |
| `docs/QA-REPORT.md` | Adversarial QA findings and fixes |
| `docs/FINAL_REPORT.md` | Summary of the whole project (this assignment's final report) |
| `docs/screenshots/` | Sign-in, dashboard, editor, share dialog and import screenshots |
| `SUBMISSION.md` | This file |

`node_modules/`, `.next/` and `data/` are intentionally excluded.

## Layout of the Google Drive folder

| Drive item | What it is |
|---|---|
| `source-code.zip` | The complete project (same tree as the GitHub repo, without `node_modules/`, `.next/`, `data/`) |
| `README.md`, `SUBMISSION.md` | Setup/run instructions; this file |
| `ARCHITECTURE.md`, `AI_WORKFLOW.md` | Architecture note; AI workflow note |
| `FINAL_REPORT.md`, `QA-REPORT.md`, `AI_PROCESS_LOG.md` | Project summary; adversarial QA; prompt-by-prompt log |
| `WALKTHROUGH_VIDEO.txt` | Walkthrough video URL |
| `screenshots/` | Sign-in, dashboard, editor, share dialog, import |

## What works

Create, rename, edit (bold, italic, underline, H1-H3, bullet and numbered lists), autosave, save and reopen; import of
.txt/.md/.docx into a new document; owner-only sharing with view/edit permission and clear owned vs shared lists;
persistence of content and sharing in Postgres (free Neon database in production, embedded PGlite locally); validation and error handling; sign-in/sign-out with signed sessions; 69 passing unit tests, a 58-check HTTP
smoke script and a ~300-check adversarial QA pass; production build and health check.

## What is incomplete

- Authentication is basic: three seeded accounts sharing one demo password, signed expiring session cookie, login throttling; no sign-up, password reset or OAuth.
- Concurrent edits are detected (version check, 409 and a reload banner) but not merged; no real-time collaboration or presence.
- Live-site database is Neon's free tier: data survives sleeps, restarts and redeploys, but the free plan has no real backups.
- `.docx` import drops tables and images; no document delete or export UI.

## What I would build next with another 2-4 hours

Real accounts (sign-up, per-user passwords or OAuth); real-time sync with presence indicators; Markdown/PDF export; version history; committed Playwright tests for the browser flows.
