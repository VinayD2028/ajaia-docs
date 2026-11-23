import { describe, expect, it } from "vitest";
import { canEdit, getAccess } from "@/lib/access";
import { removeShare, upsertShare } from "@/lib/shares";
import { ALICE, BOB, CAROL, freshDb, newDoc } from "./helpers";

describe("getAccess", () => {
  it("returns owner for the owner, even with no shares", () => {
    const db = freshDb();
    expect(getAccess(db, newDoc(db), ALICE)).toBe("owner");
  });

  it("returns null for a stranger and for an unknown document", () => {
    const db = freshDb();
    const id = newDoc(db);
    expect(getAccess(db, id, CAROL)).toBeNull();
    expect(getAccess(db, "does-not-exist", ALICE)).toBeNull();
  });

  it("returns the granted permission for a shared user", () => {
    const db = freshDb();
    const id = newDoc(db);
    upsertShare(db, id, BOB, "view");
    expect(getAccess(db, id, BOB)).toBe("view");
    expect(getAccess(db, id, CAROL)).toBeNull(); // sharing with Bob does not leak to Carol
  });

  it("applies permission changes and revocation immediately", () => {
    const db = freshDb();
    const id = newDoc(db);
    upsertShare(db, id, BOB, "view");
    upsertShare(db, id, BOB, "edit");
    expect(getAccess(db, id, BOB)).toBe("edit");
    removeShare(db, id, BOB);
    expect(getAccess(db, id, BOB)).toBeNull();
  });

  it("does not let a share on one document grant access to another", () => {
    const db = freshDb();
    const a = newDoc(db);
    const b = newDoc(db);
    upsertShare(db, a, BOB, "edit");
    expect(getAccess(db, b, BOB)).toBeNull();
  });

  it("canEdit is true only for owner and edit", () => {
    expect([canEdit("owner"), canEdit("edit"), canEdit("view"), canEdit(null)]).toEqual([true, true, false, false]);
  });
});
