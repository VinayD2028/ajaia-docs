import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { Permission } from "./db";

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
}

export const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export function listDocuments(db: Database.Database, userId: string) {
  const owned = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, u.name AS owner_name,
              (SELECT COUNT(*) FROM document_shares s WHERE s.document_id = d.id) AS share_count
       FROM documents d JOIN users u ON u.id = d.owner_id
       WHERE d.owner_id = ? ORDER BY d.updated_at DESC, d.rowid DESC`
    )
    .all(userId) as DocSummary[];
  const shared = db
    .prepare(
      `SELECT d.id, d.title, d.updated_at, u.name AS owner_name, s.permission
       FROM document_shares s
       JOIN documents d ON d.id = s.document_id
       JOIN users u ON u.id = d.owner_id
       WHERE s.user_id = ? ORDER BY d.updated_at DESC, d.rowid DESC`
    )
    .all(userId) as DocSummary[];
  return { owned, shared };
}

export function createDocument(
  db: Database.Database,
  ownerId: string,
  title = "Untitled document",
  contentJson = JSON.stringify(EMPTY_DOC)
): string {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO documents (id, owner_id, title, content_json) VALUES (?, ?, ?, ?)"
  ).run(id, ownerId, title, contentJson);
  return id;
}

export function getDocument(db: Database.Database, id: string): DocRecord | undefined {
  return db
    .prepare(
      `SELECT d.*, u.name AS owner_name
       FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`
    )
    .get(id) as DocRecord | undefined;
}

export function renameDocument(db: Database.Database, id: string, title: string) {
  db.prepare("UPDATE documents SET title = ?, updated_at = datetime('now') WHERE id = ?").run(title, id);
}

export function saveContent(db: Database.Database, id: string, contentJson: string) {
  db.prepare("UPDATE documents SET content_json = ?, updated_at = datetime('now') WHERE id = ?").run(contentJson, id);
}

export function deleteDocument(db: Database.Database, id: string) {
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);
}
