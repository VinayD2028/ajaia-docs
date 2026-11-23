# Walkthrough script (about 4 minutes at a normal pace)

Edit anything that is not true to you; say it in your own words. The facts below match what was built and tested.

**Before recording:** open https://ajaia-docs-eu0h.onrender.com a minute early so the free host is awake. Have three
tabs ready: the app, `docs/AI_WORKFLOW.md` on GitHub, and a terminal in the project. Have `tests/fixtures/sample.docx`
ready to pick. Use Loom or YouTube (unlisted) and screen-share the browser.

---

**[0:00 Sign-in page]**
"Hi, I'm Vinay. This is Ajaia Docs, a small collaborative document editor I built in a four-hour window with AI
assistance. It's a Next.js and React app with a TipTap editor, backed by Postgres on Neon, deployed with Docker on
Render. I deliberately kept the scope small, so I'll show what works end to end and what I left out. There are three
demo accounts, Alice, Bob and Carol, with one shared demo password, which I've shown here for reviewers."

**[0:20 Sign in as Alice, create a document]**
"I'll sign in as Alice and create a new document. I can rename it right in the title. I'll type some text and use bold,
italic, underline, headings, and bulleted and numbered lists. Autosave runs after a short pause and the status shows
Saving, then Saved. If I refresh, everything is still there, because the content is stored as the editor's JSON, so the
formatting survives, and it lives in Postgres, so it also survives restarts and redeploys."

**[1:15 Import]**
"For file handling I chose import. The UI says it accepts .txt, .md and .docx up to two megabytes. I'll pick a sample
Word file. It becomes a new editable document with headings, bold, underline and lists kept. The import goes through the
same editor schema as typing, so anything the editor can't represent, like scripts, is dropped. Tables and images in
docx are not kept; that's a known cut."

**[2:00 Sharing]**
"Now sharing. Alice owns this document, so she sees a Share button. I'll share it with Bob as view-only. The dashboard
separates My documents from Shared with me, with a permission badge. I'll sign out and sign in as Bob. He sees it under
Shared with me, and the editor is read-only. Back as Alice I'll upgrade Bob to edit. Carol has no access, and if she opens
the link she gets a not-found page, not a forbidden page, so document ids don't leak. The server checks access on every
route, not just in the UI."

**[3:00 Concurrency and tests]**
"Two people can open the same document. I'll make an edit in one tab, then edit in the other. The second tab doesn't
silently overwrite; it shows that the document changed elsewhere and offers a reload. That's a version number checked
on every save. It detects conflicts, it doesn't merge them. For testing, I have 69 unit tests against real Postgres, a
58-check HTTP script, and I also ran an adversarial QA pass with five hostile-tester roles. It found ten real problems,
for example a large text file that could hang the server and a Back and Forward bug that could lose text. I fixed them
in severity order and re-ran each repro."

**[3:30 AI workflow]**
"On AI: I used Claude as both prompt engineer and coding agent, in small prompts, one layer at a time, and I judged the
output by running it, not reading it. It sped up the full vertical slice and the test breadth. It also got things wrong:
docx import dropped underlined text, a native dependency broke the Docker build, and text was unreadable in dark mode.
I caught those by testing, and they're written up in the AI workflow note and the process log. I made the architecture
and hosting decisions myself, like moving to Postgres on Neon after Render's free database turned out to expire."

**[3:50 Wrap-up]**
"Deprioritized on purpose: sign-up and password reset, real-time collaboration and merging, export, version history, and
tables and images in imports. With another two to four hours I'd add real accounts, real-time sync with presence, and
Markdown and PDF export. Thanks for watching."

---

**If something goes wrong on camera:** the free host may take up to a minute to wake; wait for the sign-in page. Do not
paste real data. Do not create many test documents on the live site (they are stored in the real database).
