import { describe, expect, it } from "vitest";
import { loginThrottle, SESSION_MAX_AGE_S, signSession, verifySession } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { seed } from "@/lib/seed";
import { freshDb } from "./helpers";

describe("signed session cookie", () => {
  it("round-trips a user id", () => {
    expect(verifySession(signSession("u_alice"))).toBe("u_alice");
  });
  it("rejects the old unsigned format and empty values", () => {
    for (const v of ["u_alice", "", undefined, "u_alice.", "u_alice.123.", ".."]) expect(verifySession(v)).toBeNull();
  });
  it("rejects a tampered user id or expiry", () => {
    const [id, exp, sig] = signSession("u_alice").split(".");
    expect(verifySession(`u_bob.${exp}.${sig}`)).toBeNull();
    expect(verifySession(`${id}.${Number(exp) + 999999}.${sig}`)).toBeNull();
    expect(verifySession(`${id}.${exp}.${sig.slice(0, -2)}xx`)).toBeNull();
  });
  it("expires after the max age", () => {
    const now = Date.now();
    const v = signSession("u_alice", now);
    expect(verifySession(v, now + (SESSION_MAX_AGE_S - 5) * 1000)).toBe("u_alice");
    expect(verifySession(v, now + (SESSION_MAX_AGE_S + 5) * 1000)).toBeNull();
  });
});

describe("passwords", () => {
  it("verifies the right password and rejects wrong, empty and malformed hashes", async () => {
    const h = await hashPassword("s3cret!");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("s3cret!", h)).toBe(true);
    expect(await verifyPassword("s3cret", h)).toBe(false);
    expect(await verifyPassword("", h)).toBe(false);
    expect(await verifyPassword("s3cret!", null)).toBe(false);
    expect(await verifyPassword("s3cret!", "scrypt$zz")).toBe(false);
  });
  it("salts: same password gives different hashes", async () => {
    expect(await hashPassword("x")).not.toBe(await hashPassword("x"));
  });
  it("seeding gives every seeded user a hash, and re-seeding does not overwrite a changed one", async () => {
    const db = await freshDb();
    const rows = await db.query<{ password_hash: string | null }>("SELECT password_hash FROM users");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.password_hash?.startsWith("scrypt$"))).toBe(true);
    await db.query("UPDATE users SET password_hash = 'scrypt$aa$bb' WHERE id = 'u_bob'");
    await seed(db);
    const [bob] = await db.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = 'u_bob'");
    expect(bob.password_hash).toBe("scrypt$aa$bb");
  });
});

describe("login throttle", () => {
  it("blocks after 5 failures, resets on success and expires after the window", () => {
    const k = "t@example.com", t0 = 1_000_000;
    for (let i = 0; i < 4; i++) loginThrottle.fail(k, t0);
    expect(loginThrottle.blocked(k, t0)).toBe(false);
    loginThrottle.fail(k, t0);
    expect(loginThrottle.blocked(k, t0)).toBe(true);
    expect(loginThrottle.blocked(k, t0 + 11 * 60 * 1000)).toBe(false);
    loginThrottle.fail(k, t0); loginThrottle.reset(k);
    expect(loginThrottle.blocked(k, t0)).toBe(false);
  });
});
