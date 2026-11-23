import { NextResponse } from "next/server";
import { loginThrottle, SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { err, handleError, readJsonObject } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rejectUnknownFields, ValidationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

// Verified against when the email is unknown, so response time doesn't reveal which emails exist.
const dummyHash = hashPassword("not-a-real-password");

export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["email", "password"]);
    const { email, password } = body;
    if (typeof email !== "string" || typeof password !== "string" || !email.trim() || !password) {
      throw new ValidationError("Enter your email and password");
    }
    if (email.length > 254 || password.length > 200 || email.includes("\u0000") || password.includes("\u0000")) {
      return err("Invalid email or password", 401);
    }
    const key = email.trim().toLowerCase();
    if (loginThrottle.blocked(key)) return err("Too many failed attempts. Try again in a few minutes.", 429);

    const [row] = await (await getDb()).query<{ id: string; name: string; email: string; password_hash: string | null }>(
      "SELECT id, name, email, password_hash FROM users WHERE lower(email) = $1",
      [key]
    );
    const ok = await verifyPassword(password, row?.password_hash ?? (await dummyHash));
    if (!row || !ok) {
      loginThrottle.fail(key);
      return err("Invalid email or password", 401);
    }
    loginThrottle.reset(key);
    const res = NextResponse.json({ user: { id: row.id, name: row.name, email: row.email } });
    res.cookies.set(SESSION_COOKIE, signSession(row.id), sessionCookieOptions);
    return res;
  } catch (e) {
    return handleError(e);
  }
}
