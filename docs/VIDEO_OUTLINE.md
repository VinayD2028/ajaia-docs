# Walkthrough talk track (target 4:00, max 5:00)

Run on the live URL if it is awake (open it a minute early); otherwise run locally.

| Time | Show | Say |
|---|---|---|
| 0:00-0:20 | Sign-in page, demo accounts | What it is; three seeded users, one demo password; scope was deliberately small |
| 0:20-1:15 | Alice: New document, type, bold/italic/underline/H1/lists, rename, "Saved", refresh | Autosave, content stored as TipTap JSON so formatting survives |
| 1:15-2:00 | Import `sample.docx` / `sample.md` | Supported types shown in UI; converted through the editor schema; raw HTML dropped |
| 2:00-3:00 | Share with Bob as view; sign out and sign in as Bob (read-only, badge); upgrade to edit; Carol gets 404 | Server enforces access; 404 not 403 to avoid leaking ids |
| 3:00-3:30 | Two tabs on one doc: second tab shows the "changed elsewhere" banner; terminal: `npm test` (69 passing) | Version-checked saves; how correctness was verified; the QA pass that found 10 bugs |
| 3:30-4:00 | `AI_PROCESS_LOG.md` and `AI_WORKFLOW.md` | How AI helped; real bugs it caused and I caught (docx underline, node-gyp deploy failure); what I cut and why |

Deprioritized (say it explicitly): sign-up/password reset/OAuth (the demo accounts share one password), real-time collaboration and merge, export, version history, tables/images in docx import.
Key decisions: Postgres (Neon in prod, PGlite locally) + Docker, schema-based import, 404 on no access, whole-document autosave with a version check.

Word-for-word script: [VIDEO_SCRIPT.md](VIDEO_SCRIPT.md).
