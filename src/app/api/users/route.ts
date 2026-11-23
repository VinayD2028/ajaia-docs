import { NextResponse } from "next/server";
import { getDb, type User } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = getDb()
    .prepare("SELECT id, name, email FROM users ORDER BY name")
    .all() as User[];
  return NextResponse.json({ users });
}
