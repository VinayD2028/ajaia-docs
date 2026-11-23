import { getSchema } from "@tiptap/core";
import { editorExtensions } from "./extensions";

export const MAX_TITLE = 200;
export const MAX_DEPTH = 40;
export const MAX_CONTENT_BYTES = 1024 * 1024;

export class ValidationError extends Error {}

/** Postgres TEXT cannot store NUL; reject it up front (would otherwise be a 500). */
export const hasNul = (s: string) => s.includes("\u0000");

let schemaCache: ReturnType<typeof getSchema> | undefined;
const schema = () => (schemaCache ??= getSchema(editorExtensions));

const SAFE_HREF = /^(https?:|mailto:|tel:|#|\/)/i;

/** Iterative walk: bounded depth, safe link protocols. Throws ValidationError. */
function checkTree(root: unknown) {
  const stack: Array<[unknown, number]> = [[root, 0]];
  while (stack.length) {
    const [node, depth] = stack.pop()!;
    if (depth > MAX_DEPTH) throw new ValidationError(`content is nested too deeply (max ${MAX_DEPTH})`);
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      throw new ValidationError("content contains an invalid node");
    }
    const n = node as { type?: unknown; text?: unknown; content?: unknown; marks?: unknown };
    if (typeof n.type !== "string") throw new ValidationError("content node is missing a type");
    if (n.content !== undefined) {
      if (!Array.isArray(n.content)) throw new ValidationError("node content must be an array");
      for (const c of n.content) stack.push([c, depth + 1]);
    }
    if (n.marks !== undefined) {
      if (!Array.isArray(n.marks)) throw new ValidationError("node marks must be an array");
      for (const m of n.marks as Array<{ type?: unknown; attrs?: { href?: unknown } }>) {
        if (m?.type === "link") {
          const href = m.attrs?.href;
          if (typeof href !== "string" || !SAFE_HREF.test(href.trim())) {
            throw new ValidationError("links must start with http(s):, mailto: or tel:");
          }
        }
      }
    }
    if (n.text !== undefined && typeof n.text !== "string") throw new ValidationError("text must be a string");
  }
}

export function validateTitle(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("title must be a string");
  const title = value.trim();
  if (hasNul(value)) throw new ValidationError("title must not contain NUL characters");
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
  const body = (value as { content?: unknown }).content;
  const hasBody = body !== undefined && !(Array.isArray(body) && body.length === 0);
  // Depth check must run before JSON.stringify, which overflows the stack on very deep input.
  if (hasBody) checkTree(value);
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json, "utf8") > MAX_CONTENT_BYTES) {
    throw new ValidationError("content exceeds 1 MB");
  }
  if (hasBody) {
    try {
      schema().nodeFromJSON(value).check(); // unknown node/mark types and illegal nesting throw
    } catch {
      throw new ValidationError("content does not match the document schema");
    }
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
  if (hasNul(email)) throw new ValidationError("Enter a valid email address");
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new ValidationError("Enter a valid email address");
  return email;
}

export function validatePermission(value: unknown): "view" | "edit" {
  if (value !== "view" && value !== "edit") throw new ValidationError("permission must be 'view' or 'edit'");
  return value;
}
