import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const userId = (body as { userId?: unknown })?.userId;
  if (typeof userId !== "string" || userId.length === 0) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }
  const user = getDb()
    .prepare("SELECT id, name, email FROM users WHERE id = ?")
    .get(userId);
  if (!user) {
    return NextResponse.json({ error: "Unknown user" }, { status: 404 });
  }
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
