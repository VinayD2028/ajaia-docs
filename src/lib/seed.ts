import type Database from "better-sqlite3";

const USERS = [
  { id: "u_alice", name: "Alice", email: "alice@example.com" },
  { id: "u_bob", name: "Bob", email: "bob@example.com" },
  { id: "u_carol", name: "Carol", email: "carol@example.com" },
];

const SAMPLE_CONTENT = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Welcome to Ajaia Docs" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This sample document is owned by Alice and shared with Bob." },
      ],
    },
  ],
};

/** Idempotent: INSERT OR IGNORE on fixed ids, so re-running never duplicates. */
export function seed(db: Database.Database): void {
  const insertUser = db.prepare(
    "INSERT OR IGNORE INTO users (id, name, email) VALUES (@id, @name, @email)"
  );
  const insertDoc = db.prepare(
    "INSERT OR IGNORE INTO documents (id, owner_id, title, content_json) VALUES (?, ?, ?, ?)"
  );
  const insertShare = db.prepare(
    "INSERT OR IGNORE INTO document_shares (document_id, user_id, permission) VALUES (?, ?, ?)"
  );

  db.transaction(() => {
    for (const u of USERS) insertUser.run(u);
    insertDoc.run("d_sample", "u_alice", "Welcome to Ajaia Docs", JSON.stringify(SAMPLE_CONTENT));
    insertShare.run("d_sample", "u_bob", "edit");
  })();
}
