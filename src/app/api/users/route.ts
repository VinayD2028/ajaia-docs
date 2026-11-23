import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { listUsers } from "@/lib/shares";

export const dynamic = "force-dynamic";

export async function GET() {
  const users = await listUsers(await getDb());
  return NextResponse.json({ users });
}
