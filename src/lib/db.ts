import { seed } from "./seed";

export type Permission = "view" | "edit";

export interface User {
  id: string;
  name: string;
  email: string;
}

/** Minimal async SQL interface shared by the Postgres (`pg`) and PGlite backends. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

// Timestamps are UTC text ('YYYY-MM-DD HH24:MI:SS'): identical shape to the earlier SQLite
// version, so API responses and sorting did not change. `seq` gives a stable tiebreak.
const NOW = `to_char(timezone('utc', now()), 'YYYY-MM-DD HH24:MI:SS')`;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (${NOW}),
  updated_at TEXT NOT NULL DEFAULT (${NOW}),
  seq BIGINT GENERATED ALWAYS AS IDENTITY
);
CREATE TABLE IF NOT EXISTS document_shares (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  permission TEXT NOT NULL CHECK (permission IN ('view','edit')),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_shares_user ON document_shares(user_id);
`;

/** SQL fragment for "now" in the stored text format. */
export const SQL_NOW = NOW;

async function connectPostgres(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await pool.query(sql);
    },
    close: () => pool.end(),
  };
}

async function connectPglite(dir: string): Promise<Db> {
  // Only loaded when DATABASE_URL is absent (local dev, tests), never in production.
  const { PGlite } = await import("@electric-sql/pglite");
  const pg = new PGlite(dir);
  await pg.waitReady;
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await pg.query(sql, params)).rows as T[];
    },
    async exec(sql) {
      await pg.exec(sql);
    },
    close: () => pg.close(),
  };
}

/**
 * Opens a database, applies the (idempotent) schema and seeds demo data.
 * `target` is a postgres:// URL (managed Postgres) or a PGlite directory / "memory://".
 */
export async function openDatabase(target: string): Promise<Db> {
  const db = /^postgres(ql)?:\/\//.test(target)
    ? await connectPostgres(target)
    : await connectPglite(target);
  try {
    await db.exec(SCHEMA);
    await seed(db);
  } catch (e) {
    await db.close().catch(() => {});
    throw e;
  }
  return db;
}

// Lazy singleton: nothing touches the database at import time, so `next build` never
// connects. globalThis survives dev hot reloads. A failed open is not cached (retry next call).
const g = globalThis as unknown as { __db?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__db) {
    // The embedded database is for dev/tests. On a small production host it can exhaust memory
    // (it did on Render's 512 MB free tier), so require an explicit opt-in there.
    if (
      process.env.NODE_ENV === "production" &&
      !process.env.DATABASE_URL &&
      process.env.ALLOW_EMBEDDED_DB !== "true"
    ) {
      return Promise.reject(
        new Error("DATABASE_URL is not set (set ALLOW_EMBEDDED_DB=true to use the embedded database)")
      );
    }
    const target = process.env.DATABASE_URL ?? process.env.PGLITE_DIR ?? "./data/pgdata";
    const p = openDatabase(target);
    g.__db = p;
    p.catch(() => {
      if (g.__db === p) g.__db = undefined;
    });
  }
  return g.__db;
}
