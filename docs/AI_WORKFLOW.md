# AI-native workflow note

## Tools used

- **Claude (Sonnet 5.5)** in two roles: a *prompt engineer* that planned the phases and wrote each prompt, and the
  *coding agent* that ran each prompt in a Linux sandbox (shell, file editing, browser automation). Because one
  assistant played both roles, I used the prompts as scoped work orders with acceptance criteria, and judged the
  output by running it rather than by reading it.
- Headless Chrome driven by Playwright for UI verification; `curl` for API checks; Vitest for unit tests.
- Full prompts, results and issues per step: [`AI_PROCESS_LOG.md`](../AI_PROCESS_LOG.md).

## How the work was decomposed

Eight small prompts, each one layer with explicit acceptance criteria: scaffold and data layer, document API and access
logic, editor UI, sharing, file import, tests, deployment readiness, documentation. Each was run, verified, and only then
followed by the next, so a mistake could not hide under later work.

## Where AI materially sped things up

- Producing the full vertical slice (schema, API, editor UI, share dialog, importer) in roughly the first 30 minutes of
  the 240-minute window, leaving most of the budget for verification, deployment and documentation.
- Writing the breadth of test cases (44 unit tests and a 54-check HTTP script) and driving real-browser flows for two
  users, which would have been slow to do by hand.

## What AI-generated output I changed or rejected (real examples)

- **Rejected template defaults:** `create-next-app` generated experimental `cacheComponents`/`partialPrefetching`
  settings that force Suspense handling around `cookies()`; removed them.
- **Rejected a redundant dependency:** the prompt listed `@tiptap/extension-underline`; the installed StarterKit v3
  already bundles it, so it was uninstalled to avoid registering it twice.
- **Fixed a silent data-loss bug:** `.docx` import dropped underlined text. The acceptance criteria did not cover it; it
  was found by inspecting stored JSON, fixed with a mammoth style map, and locked in with a test.
- **Fixed a deploy-breaking bug:** `npm ci` would try to compile `better-sqlite3` (needs python/make/g++, absent from the
  slim image). Found by reproducing a clean build; fixed with `--ignore-scripts`. (Later made moot by moving to Postgres.)
- **Persistence rework:** the live site lost data on sleep/redeploy (ephemeral disk, a known tradeoff I had accepted).
  Ported the data layer to async Postgres (`pg` in production, PGlite locally/tests) and verified it against a real
  Postgres server, not just PGlite. My ported test had a real bug (awaiting a property of a Promise) that the test run caught.
- **Fixed a test-tool side effect:** my smoke script mutated the seeded demo document; added a restore step.
- **Corrected my own wrong assumption:** a prompt claimed the `Secure` cookie would not persist on `http://localhost`;
  real Chrome showed it does, so the README states the narrower, tested claim.
- **Missed a UI bug in my own tests:** the template's CSS switched to a dark background on dark-mode systems while my
  components assumed light, so text was nearly invisible on the live site in a dark-mode browser. My headless tests ran
  in light mode. Found by looking at the live site in a real dark-mode browser; fixed by forcing a light theme.
- **Missed a template instruction:** the template's `AGENTS.md` says to read the bundled Next.js docs first; this was not
  done up front. Afterwards I confirmed the build has no warnings and that the `force-dynamic` setting used on every
  route is documented as supported without Cache Components.

## How correctness, UX and reliability were verified

- **Correctness:** unit tests on real in-process Postgres (PGlite), also run against a local Postgres server; mutation checks (three deliberate breaks, each caught by tests);
  an HTTP smoke script covering auth, sharing permissions, validation and import.
- **UX:** headless-Chrome flows with screenshots: create, format, rename (including empty-title revert), refresh,
  two-user sharing (view-only vs edit, removal), file import with an invalid file.
- **Reliability:** production build run as a non-root user; health check; restart persistence with a mounted data dir;
  clean reseed without one.
- **Docker:** my sandbox had no Docker daemon, so I first reproduced the build stages in a clean directory; the real
  `docker build` then ran on Render and succeeded, and I re-ran the access/sharing checks against the live URL.
- **Not verified:** cross-browser behavior beyond Chrome, and concurrent editing.

## Candidate-only facts

<!-- TODO(candidate): add what YOU personally checked by hand before submitting (for example, clicked through the
live site as all three users, tried the import on your own files, read through the code) and anything you changed
after reviewing the generated code. Do not leave claims here that you did not do. -->
