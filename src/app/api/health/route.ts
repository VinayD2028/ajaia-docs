import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Liveness + DB check for the host's health probe. Never leaks error details. */
export async function GET() {
  try {
    await (await getDb()).query("SELECT 1");
    return NextResponse.json({ ok: true, db: true });
  } catch (e) {
    console.error("health check failed", e);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
