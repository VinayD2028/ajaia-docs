# QA-REPORT: adversarial QA and fixes

Five adversarial trials (first-time user, hostile input, access-control attacker, file-upload abuser, chaos and
concurrency) were run against a local production build with the embedded Postgres, using throwaway scripts (kept
out of the repo). About 300 checks in total. Findings were reported first, then fixed in severity order.
Each fix has a unit test and/or an HTTP/browser regression check that was re-run after the fix.

| ID | Severity | Finding | Fix |
|---|---|---|---|
| QA-001 | Critical | A ~2 MB `.txt` of 600k one-character paragraphs hung the server for ~90 s, then killed it (HTML to JSON conversion cost grows faster than file size) | Import rejects more than 20,000 paragraphs/elements before converting (400 in ~0.3 s); 15k paragraphs still import |
| QA-002 | High | Back, then Forward showed an empty editor; typing then overwrote the saved text | Editor re-reads the doc on mount / `pageshow` / tab visible and applies it if clean; saves carry a version |
| QA-003 | Medium | NUL character in a title, id, email or cookie returned 500 | Rejected as 400 / 404 / 401 |
| QA-004 | Medium | Unknown nodes, bad nesting, `javascript:` links stored; 3000-deep content returned 500 | Content checked against the TipTap schema, depth limit 40, safe link protocols, check runs before `JSON.stringify` |
| QA-005 | Medium | Two tabs/users silently overwrote each other | `documents.version` + `baseVersion` on save, 409 on conflict, banner with reload link |
| QA-006 | Low | Offline edits not retried until the next keystroke | Retry every 3 s on network/5xx errors and on the `online` event |
| QA-007 | Low | Share dialog: no focus trap, no focus return, failed add cleared the email | Focus trap, focus restored, email kept on failure |
| QA-008 | Low | Double-clicking Share closed the dialog immediately | Backdrop needs a press and release on it, ignored for the first 500 ms |
| QA-009 | Low | Non-UTF-8 / binary `.txt` accepted and mangled | Strict UTF-8 decode, NUL bytes rejected, BOM stripped |
| QA-010 | Low | 70 px horizontal overflow at 375 px; 28 px toolbar buttons | `min-w-0`, flex-wrap, narrower header select, 36 px buttons |

## Not fixed / out of scope
- No sign-out control (the user switcher stands in for auth in this demo); `/api/users` is unauthenticated by design.
- No live sync or merge between editors (conflicts are detected, not merged).
- Not tested: the live Render + Neon deployment under these scripts, Safari/Firefox, axe accessibility scan.
