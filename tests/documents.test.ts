import type { Db } from "@/lib/db";
import { describe, expect, it } from "vitest";
import { createDocument, deleteDocument, getDocument, listDocuments, renameDocument, saveContent } from "@/lib/documents";
import { seed } from "@/lib/seed";
import { upsertShare } from "@/lib/shares";
import { ALICE, BOB, CAROL, freshDb, newDoc } from "./helpers";

const count = async (db: Db, table: string) =>
  (await db.query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${table}`))[0].n;

describe("documents", () => {
  it("splits owned and shared lists, with permission only on shared rows", async () => {
    const db = await freshDb();
    const mine = await newDoc(db, ALICE, "Mine");
    const bobs = await newDoc(db, BOB, "Bob's");
    await upsertShare(db, bobs, ALICE, "view");
    const { owned, shared } = await listDocuments(db, ALICE);
    expect(owned.map((d) => d.id)).toContain(mine);
    expect(owned.map((d) => d.id)).not.toContain(bobs);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ id: bobs, permission: "view", owner_name: "Bob" });
    expect(owned.every((d) => d.permission === undefined)).toBe(true);
  });

  it("counts shares per owned document without mixing documents up", async () => {
    const db = await freshDb();
    const a = await newDoc(db, ALICE, "A");
    const b = await newDoc(db, ALICE, "B");
    await upsertShare(db, a, BOB, "view");
    await upsertShare(db, a, CAROL, "edit");
    const { owned } = await listDocuments(db, ALICE);
    expect(owned.find((d) => d.id === a)?.share_count).toBe(2);
    expect(owned.find((d) => d.id === b)?.share_count).toBe(0);
  });

  it("round-trips rich content JSON and bumps updated_at semantics on rename/save", async () => {
    const db = await freshDb();
    const id = await createDocument(db, ALICE);
    const content = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }] }] }] };
    await saveContent(db, id, JSON.stringify(content));
    await renameDocument(db, id, "Renamed");
    const doc = (await getDocument(db, id))!;
    expect(doc.title).toBe("Renamed");
    expect(JSON.parse(doc.content_json)).toEqual(content);
  });

  it("deleting a document cascades to its shares", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await upsertShare(db, id, BOB, "edit");
    const before = await count(db, "document_shares");
    await deleteDocument(db, id);
    expect(await getDocument(db, id)).toBeUndefined();
    expect(await count(db, "document_shares")).toBe(before - 1);
  });

  it("seed is idempotent: re-running does not duplicate rows or overwrite edits", async () => {
    const db = await freshDb();
    await renameDocument(db, "d_sample", "Edited by a reviewer");
    const tables = ["users", "documents", "document_shares"];
    const counts = await Promise.all(tables.map((t) => count(db, t)));
    await seed(db);
    await seed(db);
    expect(await Promise.all(tables.map((t) => count(db, t)))).toEqual(counts);
    expect((await getDocument(db, "d_sample"))!.title).toBe("Edited by a reviewer");
  });
});
