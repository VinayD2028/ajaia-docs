import { describe, expect, it } from "vitest";
import { canEdit, getAccess } from "@/lib/access";
import { removeShare, upsertShare } from "@/lib/shares";
import { ALICE, BOB, CAROL, freshDb, newDoc } from "./helpers";

describe("getAccess", () => {
  it("returns owner for the owner, even with no shares", async () => {
    const db = await freshDb();
    expect(await getAccess(db, await newDoc(db), ALICE)).toBe("owner");
  });

  it("returns null for a stranger and for an unknown document", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    expect(await getAccess(db, id, CAROL)).toBeNull();
    expect(await getAccess(db, "does-not-exist", ALICE)).toBeNull();
  });

  it("returns the granted permission for a shared user", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await upsertShare(db, id, BOB, "view");
    expect(await getAccess(db, id, BOB)).toBe("view");
    expect(await getAccess(db, id, CAROL)).toBeNull(); // sharing with Bob does not leak to Carol
  });

  it("applies permission changes and revocation immediately", async () => {
    const db = await freshDb();
    const id = await newDoc(db);
    await upsertShare(db, id, BOB, "view");
    await upsertShare(db, id, BOB, "edit");
    expect(await getAccess(db, id, BOB)).toBe("edit");
    await removeShare(db, id, BOB);
    expect(await getAccess(db, id, BOB)).toBeNull();
  });

  it("does not let a share on one document grant access to another", async () => {
    const db = await freshDb();
    const a = await newDoc(db);
    const b = await newDoc(db);
    await upsertShare(db, a, BOB, "edit");
    expect(await getAccess(db, b, BOB)).toBeNull();
  });

  it("canEdit is true only for owner and edit", async () => {
    expect([canEdit("owner"), canEdit("edit"), canEdit("view"), canEdit(null)]).toEqual([true, true, false, false]);
  });
});
