export const MAX_TITLE = 200;
export const MAX_CONTENT_BYTES = 1024 * 1024;

export class ValidationError extends Error {}

export function validateTitle(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("title must be a string");
  const title = value.trim();
  if (title.length < 1 || title.length > MAX_TITLE) {
    throw new ValidationError(`title must be 1-${MAX_TITLE} characters`);
  }
  return title;
}

/** Content must be a TipTap/ProseMirror doc object and at most 1 MB serialized. */
export function validateContent(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ValidationError("content must be an object");
  }
  if ((value as { type?: unknown }).type !== "doc") {
    throw new ValidationError("content.type must be 'doc'");
  }
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_CONTENT_BYTES) {
    throw new ValidationError("content exceeds 1 MB");
  }
  return json;
}

/** Throws if body has keys outside the allowed list. */
export function rejectUnknownFields(body: object, allowed: string[]): void {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  if (extra.length) throw new ValidationError(`unknown field(s): ${extra.join(", ")}`);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("email must be a string");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ValidationError("Enter a valid email address");
  return email;
}

export function validatePermission(value: unknown): "view" | "edit" {
  if (value !== "view" && value !== "edit") throw new ValidationError("permission must be 'view' or 'edit'");
  return value;
}
