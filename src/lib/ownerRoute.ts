import { NextResponse } from "next/server";
import { getAccess } from "./access";
import { getDb, type Db } from "./db";
import { err, requireUser } from "./http";
import type { User } from "./db";

/** Shared guard for owner-only document routes: returns {user, db} or an error response. */
export async function requireOwner(
  docId: string
): Promise<{ user: User; db: Db } | NextResponse> {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const db = await getDb();
  const access = await getAccess(db, docId, user.id);
  if (!access) return err("Document not found", 404);
  if (access !== "owner") return err("Only the owner can manage sharing", 403);
  return { user, db };
}
