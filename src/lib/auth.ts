import { cookies } from "next/headers";
import { getDb, type User } from "./db";
import { findUserById } from "./shares";

export const SESSION_COOKIE = "uid";

/** Returns the user identified by the session cookie, or null. */
export async function getCurrentUser(): Promise<User | null> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id) return null;
  return (await findUserById(await getDb(), id)) ?? null;
}
