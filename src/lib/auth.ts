import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, type User } from "./db";
import { findUserById } from "./shares";

export const SESSION_COOKIE = "uid";
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7;

const g = globalThis as unknown as { __sessionSecret?: string };

/** SESSION_SECRET if set; else derived from DATABASE_URL (itself a secret); else random per process. */
function secret(): string {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.DATABASE_URL) return createHash("sha256").update("ajaia-session:" + process.env.DATABASE_URL).digest("hex");
  return (g.__sessionSecret ??= randomBytes(32).toString("hex"));
}

const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Cookie value: <userId>.<expiry epoch seconds>.<HMAC>. Tamper-proof, expires. */
export function signSession(userId: string, now = Date.now()): string {
  const payload = `${userId}.${Math.floor(now / 1000) + SESSION_MAX_AGE_S}`;
  return `${payload}.${mac(payload)}`;
}

/** Returns the user id if the cookie value is authentic and unexpired, else null. */
export function verifySession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length < 3) return null;
  const sig = parts.pop()!;
  const payload = parts.join(".");
  const expected = Buffer.from(mac(payload));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const exp = Number(parts.pop());
  const userId = parts.join(".");
  if (!Number.isFinite(exp) || exp * 1000 < now || !userId) return null;
  return userId;
}

/** Returns the signed-in user (from a valid signed session cookie), or null. */
export async function getCurrentUser(): Promise<User | null> {
  const id = verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!id) return null;
  return (await findUserById(await getDb(), id)) ?? null;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_MAX_AGE_S,
};

/** Failed-login throttle (in memory, per server instance): 5 failures per 10 minutes per email. */
const attempts = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 5;
export const loginThrottle = {
  blocked(key: string, now = Date.now()) {
    const a = attempts.get(key);
    if (!a) return false;
    if (now - a.first > WINDOW_MS) { attempts.delete(key); return false; }
    return a.n >= MAX_FAILS;
  },
  fail(key: string, now = Date.now()) {
    const a = attempts.get(key);
    if (!a || now - a.first > WINDOW_MS) attempts.set(key, { n: 1, first: now });
    else a.n++;
    if (attempts.size > 5000) attempts.clear();
  },
  reset(key: string) { attempts.delete(key); },
};
