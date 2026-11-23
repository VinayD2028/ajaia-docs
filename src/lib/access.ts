import type { Db } from "./db";

export type Access = "owner" | "edit" | "view";

/** Resolves what a user may do with a document; null means no access at all. */
export async function getAccess(db: Db, docId: string, userId: string): Promise<Access | null> {
  if (docId.includes("\u0000") || userId.includes("\u0000")) return null;
  const [doc] = await db.query<{ owner_id: string }>(
    "SELECT owner_id FROM documents WHERE id = $1",
    [docId]
  );
  if (!doc) return null;
  if (doc.owner_id === userId) return "owner";
  const [share] = await db.query<{ permission: "view" | "edit" }>(
    "SELECT permission FROM document_shares WHERE document_id = $1 AND user_id = $2",
    [docId, userId]
  );
  return share?.permission ?? null;
}

export const canEdit = (a: Access | null) => a === "owner" || a === "edit";
