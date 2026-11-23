import type { Db } from "./db";

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

/** Idempotent: ON CONFLICT DO NOTHING on fixed ids, so re-running never duplicates. */
export async function seed(db: Db): Promise<void> {
  for (const u of USERS) {
    await db.query(
      "INSERT INTO users (id, name, email) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [u.id, u.name, u.email]
    );
  }
  await db.query(
    "INSERT INTO documents (id, owner_id, title, content_json) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
    ["d_sample", "u_alice", "Welcome to Ajaia Docs", JSON.stringify(SAMPLE_CONTENT)]
  );
  await db.query(
    "INSERT INTO document_shares (document_id, user_id, permission) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
    ["d_sample", "u_bob", "edit"]
  );
}
