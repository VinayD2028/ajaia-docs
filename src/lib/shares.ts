import type { Db, Permission, User } from "./db";

export interface ShareRow {
  user_id: string;
  name: string;
  email: string;
  permission: Permission;
}

export function listShares(db: Db, docId: string): Promise<ShareRow[]> {
  return db.query<ShareRow>(
    `SELECT s.user_id, u.name, u.email, s.permission
     FROM document_shares s JOIN users u ON u.id = s.user_id
     WHERE s.document_id = $1 ORDER BY u.name`,
    [docId]
  );
}

/** Re-sharing with the same user updates their permission. */
export async function upsertShare(db: Db, docId: string, userId: string, permission: Permission) {
  await db.query(
    `INSERT INTO document_shares (document_id, user_id, permission) VALUES ($1, $2, $3)
     ON CONFLICT (document_id, user_id) DO UPDATE SET permission = excluded.permission`,
    [docId, userId, permission]
  );
}

export async function removeShare(db: Db, docId: string, userId: string): Promise<boolean> {
  const rows = await db.query(
    "DELETE FROM document_shares WHERE document_id = $1 AND user_id = $2 RETURNING user_id",
    [docId, userId]
  );
  return rows.length > 0;
}

export async function findUserByEmail(db: Db, email: string): Promise<User | undefined> {
  const [u] = await db.query<User>(
    "SELECT id, name, email FROM users WHERE lower(email) = lower($1)",
    [email.trim()]
  );
  return u;
}

export function listUsers(db: Db): Promise<User[]> {
  return db.query<User>("SELECT id, name, email FROM users ORDER BY name");
}

export async function findUserById(db: Db, id: string): Promise<User | undefined> {
  const [u] = await db.query<User>("SELECT id, name, email FROM users WHERE id = $1", [id]);
  return u;
}
