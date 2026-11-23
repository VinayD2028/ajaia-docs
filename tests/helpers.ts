import type Database from "better-sqlite3";
import { openDatabase } from "@/lib/db";
import { createDocument } from "@/lib/documents";

/** Fresh in-memory DB (schema + seed: Alice, Bob, Carol, doc d_sample). */
export const freshDb = (): Database.Database => openDatabase(":memory:");

export const ALICE = "u_alice";
export const BOB = "u_bob";
export const CAROL = "u_carol";

export const newDoc = (db: Database.Database, owner = ALICE, title = "T") =>
  createDocument(db, owner, title);
