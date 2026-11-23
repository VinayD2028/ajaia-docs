import type Database from "better-sqlite3";

export type Access = "owner" | "edit" | "view";

/** Resolves what a user may do with a document; null means no access at all. */
export function getAccess(
  db: Database.Database,
  docId: string,
  userId: string
): Access | null {
  const doc = db
    .prepare("SELECT owner_id FROM documents WHERE id = ?")
    .get(docId) as { owner_id: string } | undefined;
  if (!doc) return null;
  if (doc.owner_id === userId) return "owner";
  const share = db
    .prepare("SELECT permission FROM document_shares WHERE document_id = ? AND user_id = ?")
    .get(docId, userId) as { permission: "view" | "edit" } | undefined;
  return share?.permission ?? null;
}

export const canEdit = (a: Access | null) => a === "owner" || a === "edit";
