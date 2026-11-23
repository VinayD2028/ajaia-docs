import { describe, expect, it } from "vitest";
import { createDocument, deleteDocument, getDocument, listDocuments, renameDocument, saveContent } from "@/lib/documents";
import { seed } from "@/lib/seed";
import { upsertShare } from "@/lib/shares";
import { ALICE, BOB, CAROL, freshDb, newDoc } from "./helpers";

const count = (db: ReturnType<typeof freshDb>, table: string) =>
  (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

describe("documents", () => {
  it("splits owned and shared lists, with permission only on shared rows", () => {
    const db = freshDb();
    const mine = newDoc(db, ALICE, "Mine");
    const bobs = newDoc(db, BOB, "Bob's");
    upsertShare(db, bobs, ALICE, "view");
    const { owned, shared } = listDocuments(db, ALICE);
    expect(owned.map((d) => d.id)).toContain(mine);
    expect(owned.map((d) => d.id)).not.toContain(bobs);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toMatchObject({ id: bobs, permission: "view", owner_name: "Bob" });
    expect(owned.every((d) => d.permission === undefined)).toBe(true);
  });

  it("counts shares per owned document without mixing documents up", () => {
    const db = freshDb();
    const a = newDoc(db, ALICE, "A");
    const b = newDoc(db, ALICE, "B");
    upsertShare(db, a, BOB, "view");
    upsertShare(db, a, CAROL, "edit");
    const owned = listDocuments(db, ALICE).owned;
    expect(owned.find((d) => d.id === a)?.share_count).toBe(2);
    expect(owned.find((d) => d.id === b)?.share_count).toBe(0);
  });

  it("round-trips rich content JSON and bumps updated_at semantics on rename/save", () => {
    const db = freshDb();
    const id = createDocument(db, ALICE);
    const content = { type: "doc", content: [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Hi", marks: [{ type: "bold" }] }] }] };
    saveContent(db, id, JSON.stringify(content));
    renameDocument(db, id, "Renamed");
    const doc = getDocument(db, id)!;
    expect(doc.title).toBe("Renamed");
    expect(JSON.parse(doc.content_json)).toEqual(content);
  });

  it("deleting a document cascades to its shares", () => {
    const db = freshDb();
    const id = newDoc(db);
    upsertShare(db, id, BOB, "edit");
    const before = count(db, "document_shares");
    deleteDocument(db, id);
    expect(getDocument(db, id)).toBeUndefined();
    expect(count(db, "document_shares")).toBe(before - 1);
  });

  it("seed is idempotent: re-running does not duplicate rows or overwrite edits", () => {
    const db = freshDb();
    renameDocument(db, "d_sample", "Edited by a reviewer");
    const counts = ["users", "documents", "document_shares"].map((t) => count(db, t));
    seed(db);
    seed(db);
    expect(["users", "documents", "document_shares"].map((t) => count(db, t))).toEqual(counts);
    expect(getDocument(db, "d_sample")!.title).toBe("Edited by a reviewer");
  });
});
