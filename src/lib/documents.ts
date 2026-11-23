import { randomUUID } from "node:crypto";
import { SQL_NOW, type Db, type Permission } from "./db";

export interface DocSummary {
  id: string;
  title: string;
  updated_at: string;
  owner_name: string;
  permission?: Permission; // only on shared docs
  share_count?: number; // only on owned docs
}

export interface DocRecord {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  content_json: string;
  created_at: string;
  updated_at: string;
  version: number;
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export async function listDocuments(db: Db, userId: string) {
  const owned = await db.query<DocSummary>(
    `SELECT d.id, d.title, d.updated_at, u.name AS owner_name,
            (SELECT COUNT(*)::int FROM document_shares s WHERE s.document_id = d.id) AS share_count
     FROM documents d JOIN users u ON u.id = d.owner_id
     WHERE d.owner_id = $1 ORDER BY d.updated_at DESC, d.seq DESC`,
    [userId]
  );
  const shared = await db.query<DocSummary>(
    `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, s.permission
     FROM document_shares s
     JOIN documents d ON d.id = s.document_id
     JOIN users u ON u.id = d.owner_id
     WHERE s.user_id = $1 ORDER BY d.updated_at DESC, d.seq DESC`,
    [userId]
  );
  return { owned, shared };
}

export async function createDocument(
  db: Db,
  ownerId: string,
  title = "Untitled document",
  contentJson = JSON.stringify(EMPTY_DOC)
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO documents (id, owner_id, title, content_json) VALUES ($1, $2, $3, $4)",
    [id, ownerId, title, contentJson]
  );
  return id;
}

export async function getDocument(db: Db, id: string): Promise<DocRecord | undefined> {
  const [row] = await db.query<DocRecord>(
    `SELECT d.id, d.owner_id, d.title, d.content_json, d.created_at, d.updated_at, d.version, u.name AS owner_name
     FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = $1`,
    [id]
  );
  return row;
}

export async function renameDocument(db: Db, id: string, title: string) {
  await db.query(`UPDATE documents SET title = $1, updated_at = ${SQL_NOW} WHERE id = $2`, [title, id]);
}

/**
 * Saves content and bumps the version. With `baseVersion`, the write only happens if the document
 * is still at that version (optimistic concurrency); returns null on a conflict.
 */
export async function saveContent(
  db: Db,
  id: string,
  contentJson: string,
  baseVersion?: number
): Promise<number | null> {
  const rows = await db.query<{ version: number }>(
    `UPDATE documents SET content_json = $1, version = version + 1, updated_at = ${SQL_NOW}
     WHERE id = $2 AND ($3::int IS NULL OR version = $3::int) RETURNING version`,
    [contentJson, id, baseVersion ?? null]
  );
  return rows[0]?.version ?? null;
}

export async function deleteDocument(db: Db, id: string) {
  await db.query("DELETE FROM documents WHERE id = $1", [id]);
}
