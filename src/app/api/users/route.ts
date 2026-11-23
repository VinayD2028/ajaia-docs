import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/http";
import { listUsers } from "@/lib/shares";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const users = await listUsers(await getDb());
  return NextResponse.json({ users });
}
