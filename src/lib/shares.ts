import type Database from "better-sqlite3";
import type { Permission, User } from "./db";

export interface ShareRow {
  user_id: string;
  name: string;
  email: string;
  permission: Permission;
}

export function listShares(db: Database.Database, docId: string): ShareRow[] {
  return db
    .prepare(
      `SELECT s.user_id, u.name, u.email, s.permission
       FROM document_shares s JOIN users u ON u.id = s.user_id
       WHERE s.document_id = ? ORDER BY u.name`
    )
    .all(docId) as ShareRow[];
}

/** Re-sharing with the same user updates their permission. */
export function upsertShare(db: Database.Database, docId: string, userId: string, permission: Permission) {
  db.prepare(
    `INSERT INTO document_shares (document_id, user_id, permission) VALUES (?, ?, ?)
     ON CONFLICT(document_id, user_id) DO UPDATE SET permission = excluded.permission`
  ).run(docId, userId, permission);
}

export function removeShare(db: Database.Database, docId: string, userId: string): boolean {
  return db.prepare("DELETE FROM document_shares WHERE document_id = ? AND user_id = ?").run(docId, userId).changes > 0;
}

export function findUserByEmail(db: Database.Database, email: string): User | undefined {
  return db
    .prepare("SELECT id, name, email FROM users WHERE lower(email) = lower(?)")
    .get(email.trim()) as User | undefined;
}
