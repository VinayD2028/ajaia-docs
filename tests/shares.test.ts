import { describe, expect, it } from "vitest";
import { findUserByEmail, listShares, removeShare, upsertShare } from "@/lib/shares";
import { BOB, CAROL, freshDb, newDoc } from "./helpers";

describe("shares", () => {
  it("upsert is idempotent and updates the permission instead of duplicating", () => {
    const db = freshDb();
    const id = newDoc(db);
    upsertShare(db, id, BOB, "view");
    upsertShare(db, id, BOB, "view");
    upsertShare(db, id, BOB, "edit");
    const shares = listShares(db, id);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ user_id: BOB, permission: "edit", email: "bob@example.com" });
  });

  it("rejects an invalid permission at the database level", () => {
    const db = freshDb();
    const id = newDoc(db);
    expect(() => db.prepare("INSERT INTO document_shares VALUES (?, ?, 'admin')").run(id, BOB)).toThrow();
  });

  it("removeShare reports whether anything was removed", () => {
    const db = freshDb();
    const id = newDoc(db);
    upsertShare(db, id, CAROL, "view");
    expect(removeShare(db, id, CAROL)).toBe(true);
    expect(removeShare(db, id, CAROL)).toBe(false);
  });

  it("findUserByEmail is case-insensitive, trims, and returns undefined for unknown", () => {
    const db = freshDb();
    expect(findUserByEmail(db, "  BOB@Example.COM ")?.id).toBe(BOB);
    expect(findUserByEmail(db, "nobody@example.com")).toBeUndefined();
  });

  it("is safe against SQL injection in the email lookup", () => {
    const db = freshDb();
    expect(findUserByEmail(db, "' OR '1'='1")).toBeUndefined();
  });
});
