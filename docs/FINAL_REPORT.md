# Final report: Ajaia Docs (collaborative document editor)

Take-home assignment, 240-minute window, 12:45 to 16:45 ET on 23 Nov 2026. AI-permitted; every AI step is logged in
[`AI_PROCESS_LOG.md`](../AI_PROCESS_LOG.md).

**Live app:** https://ajaia-docs-eu0h.onrender.com (free Render instance; the first request after idle can take about a
minute). **Repo:** https://github.com/VinayD2028/ajaia-docs. **Accounts:** `alice@example.com`, `bob@example.com`,
`carol@example.com`, password `ajaia-demo` for all three.

## 1. What I built

A small full-stack document editor: Next.js 16 (App Router) and React 19 with TypeScript, a TipTap v3 rich-text editor,
Tailwind v4, and Postgres (Neon in production, embedded PGlite locally and in tests).

| Requirement | What exists |
|---|---|
| Create, rename, edit, save, reopen | Dashboard with New document; inline title rename; 800 ms autosave with flush on leave; status text (Saving / Saved / Save failed) |
| Rich text | Bold, italic, underline, H1-H3, bulleted and numbered lists; content stored as ProseMirror JSON |
| File upload | `.txt`, `.md`, `.docx` (max 2 MB, UTF-8, up to 20,000 paragraphs) become a new editable document; supported types shown in the UI and README |
| Sharing | Owner shares by email as *Can view* or *Can edit*; change or remove access; dashboard separates **My documents** from **Shared with me** with a permission badge; view-only users get a read-only editor |
| Persistence | Documents, content and shares in Postgres; survive refresh, restart and redeploy (verified by restarting the server) |
| Sign-in | Email and password; scrypt hashes; signed, expiring httpOnly session cookie; Sign out; one user per browser until sign-out |
| Validation and errors | Title, content-schema, depth and size checks; 400/401/403/404/409/413/429 with plain messages; no half-created documents on failed imports |
| Tests | 69 unit tests (real Postgres via PGlite), a 58-check HTTP smoke script, ~300 adversarial QA checks |
| Docs | README, architecture note, AI workflow note, QA report, SUBMISSION, video outline and link file |
| Deployment | Docker image on Render (Blueprint `render.yaml`), Neon database, `/api/health` check |

## 2. Key decisions and tradeoffs

- **Scope:** depth on editing, sharing, import and persistence; no real-time collaboration, comments or export.
- **Storage:** content as TipTap JSON (keeps structure exactly); async `Db` interface over `pg` in production and PGlite
  elsewhere so tests run on real Postgres semantics.
- **Hosting:** first SQLite on Render's free disk (lost data on sleep), then Postgres. Render's free database is deleted
  after 30 days, so the live site uses Neon's free plan, which has no expiry (but no real backups).
- **Access model:** 404 (not 403) when you have no access, so document ids don't leak; 403 for view-only writes and
  non-owner sharing.
- **Concurrency:** a version number per document; a stale save gets 409 and a reload banner instead of silently
  overwriting. Conflicts are detected, not merged.
- **Auth:** deliberately basic (three seeded users, one published demo password); see limits below.

Full detail: [`ARCHITECTURE.md`](ARCHITECTURE.md).

## 3. How it was built (timeline, minutes into the 240)

| Window | Work |
|---|---|
| 0-30 | Scaffold, data layer, document API, editor UI, sharing, import (small single-layer prompts, each checked by running code) |
| 30-60 | Tests, Docker and deploy readiness, documentation, first deploy to Render |
| 60-105 | Persistence rework: SQLite to Postgres, Neon, restart-persistence check, production guard after an out-of-memory deploy |
| 105-130 | Adversarial QA: 5 trials, 10 findings, then fixes in severity order |
| 130-155 | Sign-in/sign-out with signed sessions; live-site checks |
| 155+ | Final documentation, screenshots, Drive folder |

## 4. Adversarial QA and fixes

Report-only first, then fixed. Full table: [`QA-REPORT.md`](QA-REPORT.md).

- **Critical:** a ~2 MB text file of one-character paragraphs hung and then killed the server. Fixed with an element cap checked before conversion.
- **High:** Back then Forward showed an empty editor and typing wiped the saved text. Fixed by re-reading the document on Back/Forward/tab focus and by version-checked saves. The exact cause of the stale page was inferred, not proven; the fix is verified by repro.
- **Medium:** NUL characters caused 500s; content validation was weak (unknown nodes, `javascript:` links, deep nesting); two tabs overwrote each other silently. All fixed.
- **Low:** offline edits not retried; share-dialog focus and double-click problems; non-UTF-8 files mangled; mobile overflow. All fixed.

## 5. What I verified, and what I did not

Verified: 69 unit tests; the 58-check smoke script; 67 access-control checks (no leaks, correct 401/403/404, revocation);
browser flows for two and three users; repro scripts for all ten QA findings after the fixes; live-site sign-in, sign-out,
access and health after deployment.

Not verified: Safari and Firefox; an automated accessibility scan; the live site under the adversarial scripts (they ran
on a local production build); behaviour under real load.

## 6. AI usage (summary)

Claude acted as prompt engineer, coding agent and process logger. It produced the vertical slice, the tests and the
fixes; I chose the architecture tradeoffs, ran the account and deploy steps (Render, GitHub, Neon, database secret),
uploaded the code, and tried the live site. I did not hand-write the application code or read every generated line; I
relied on tests, scripts and live checks. Real defects found by checking rather than trusting are listed in
[`AI_WORKFLOW.md`](AI_WORKFLOW.md) and the log.

## 7. Known limitations and what I would build next (2-4 hours)

Limitations:
- Seeded accounts sharing one public demo password; no sign-up, reset or OAuth; login throttling is in memory per instance; no CSRF tokens beyond SameSite=Lax.
- No merge or live collaboration; no presence indicators.
- `.docx` import keeps text, headings, bold/italic/underline and lists only (no tables or images); no document delete UI; no export.
- The live database is Neon's free tier: no real backups.

Next:
1. Real accounts (sign-up, per-user passwords or OAuth, server-side session revocation).
2. Real-time sync (Yjs or similar) with presence.
3. Markdown/PDF export and version history.
4. Committed Playwright tests in CI, an accessibility scan, and scheduled off-host database backups.
