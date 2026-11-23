import { openDatabase, type Db } from "@/lib/db";
import { seed } from "@/lib/seed";
import { createDocument } from "@/lib/documents";

// One in-process Postgres (PGlite) per test file; each test starts from a clean, reseeded state.
let shared: Promise<Db> | undefined;

/** Clean DB (schema + seed: Alice, Bob, Carol, doc d_sample). */
export async function freshDb(): Promise<Db> {
  shared ??= openDatabase(process.env.TEST_DATABASE_URL ?? "memory://");
  const db = await shared;
  await db.exec("TRUNCATE document_shares, documents, users CASCADE");
  await seed(db);
  return db;
}

export const ALICE = "u_alice";
export const BOB = "u_bob";
export const CAROL = "u_carol";

export const newDoc = (db: Db, owner = ALICE, title = "T") => createDocument(db, owner, title);
