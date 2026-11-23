import { NextResponse } from "next/server";
import { getAccess } from "./access";
import { getDb } from "./db";
import type Database from "better-sqlite3";
import { err, requireUser } from "./http";
import type { User } from "./db";

/** Shared guard for owner-only document routes: returns {user, db} or an error response. */
export async function requireOwner(
  docId: string
): Promise<{ user: User; db: Database.Database } | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const db = getDb();
  const access = getAccess(db, docId, user.id);
  if (!access) return err("Document not found", 404);
  if (access !== "owner") return err("Only the owner can manage sharing", 403);
  return { user, db };
}
