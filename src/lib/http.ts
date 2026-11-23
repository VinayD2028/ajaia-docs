import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import { ValidationError } from "./validate";
import type { User } from "./db";

export const err = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

/** Returns the signed-in user or a 401 response. */
export async function requireUser(): Promise<User | NextResponse> {
  const user = await getCurrentUser();
  return user ?? err("Not signed in", 401);
}

/** Parses a JSON object body; throws ValidationError on anything else. */
export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("Invalid JSON body");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new ValidationError("Body must be a JSON object");
  }
  return body as Record<string, unknown>;
}

export function handleError(e: unknown) {
  if (e instanceof ValidationError) return err(e.message, 400);
  console.error(e);
  return err("Internal server error", 500);
}
