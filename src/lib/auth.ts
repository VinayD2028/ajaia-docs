import { cookies } from "next/headers";
import { getDb, type User } from "./db";

export const SESSION_COOKIE = "uid";

/** Returns the user identified by the session cookie, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  const user = getDb()
    .prepare("SELECT id, name, email FROM users WHERE id = ?")
    .get(id) as User | undefined;
  return user ?? null;
}
