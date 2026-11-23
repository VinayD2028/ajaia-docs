import { describe, expect, it } from "vitest";
import { findUserByEmail, listShares, removeShare, upsertShare } from "@/lib/shares";
import { BOB, CAROL, freshDb, newDoc } from "./helpers";

describe("shares", () => {
  it("upsert is idempotent and updates the permission instead of duplicating", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await upsertShare(db, id, BOB, "view");
    await upsertShare(db, id, BOB, "view");
    await upsertShare(db, id, BOB, "edit");
    const shares = await listShares(db, id);
    expect(shares).toHaveLength(1);
    expect(shares[0]).toMatchObject({ user_id: BOB, permission: "edit", email: "bob@example.com" });
  });

  it("rejects an invalid permission at the database level", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await expect(
      db.query("INSERT INTO document_shares VALUES ($1, $2, 'admin')", [id, BOB])
    ).rejects.toThrow();
  });

  it("removeShare reports whether anything was removed", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await upsertShare(db, id, CAROL, "view");
    expect(await removeShare(db, id, CAROL)).toBe(true);
    expect(await removeShare(db, id, CAROL)).toBe(false);
  });

  it("findUserByEmail is case-insensitive, trims, and returns undefined for unknown", async () => {
    const db = await freshDb();
    expect((await findUserByEmail(db, "  BOB@Example.COM "))?.id).toBe(BOB);
    expect(await findUserByEmail(db, "nobody@example.com")).toBeUndefined();
  });

  it("is safe against SQL injection in the email lookup", async () => {
    const db = await freshDb();
    expect(await findUserByEmail(db, "' OR '1'='1")).toBeUndefined();
  });
});
