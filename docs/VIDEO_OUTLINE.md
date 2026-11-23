# Walkthrough talk track (target 4:00, max 5:00)

Run on the live URL if it is awake (open it a minute early); otherwise run locally.

| Time | Show | Say |
|---|---|---|
| 0:00-0:20 | Landing page, user switcher | What it is; mock users, no passwords; scope was deliberately small |
| 0:20-1:15 | Alice: New document, type, bold/italic/underline/H1/lists, rename, "Saved", refresh | Autosave, content stored as TipTap JSON so formatting survives |
| 1:15-2:00 | Import `sample.docx` / `sample.md` | Supported types shown in UI; converted through the editor schema; raw HTML dropped |
| 2:00-3:00 | Share with Bob as view; switch to Bob (read-only, badge); upgrade to edit; Carol gets 404 | Server enforces access; 404 not 403 to avoid leaking ids |
| 3:00-3:30 | Terminal: `npm test` (43 passing), smoke script; mention mutation checks | How correctness was verified |
| 3:30-4:00 | `AI_PROCESS_LOG.md` and `AI_WORKFLOW.md` | How AI helped; real bugs it caused and I caught (docx underline, node-gyp deploy failure); what I cut and why |

Deprioritized (say it explicitly): real auth, real-time collaboration, durable DB on the free host, rich docx import.
Key decisions: SQLite + Docker, schema-based import, 404 on no access, whole-document autosave.
