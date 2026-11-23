import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { marked } from "marked";
import { editorExtensions } from "./extensions";
import { validateContent, ValidationError } from "./validate";

export const SUPPORTED_TYPES = [".txt", ".md", ".docx"] as const;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

type Node = Record<string, unknown>;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function titleFrom(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();
  return (base || "Imported document").slice(0, 200);
}

/** Converts an uploaded file into a title + TipTap JSON. Throws ValidationError on bad input. */
export async function importFile(name: string, bytes: Buffer): Promise<{ title: string; content: Node }> {
  const ext = extensionOf(name);
  if (!(SUPPORTED_TYPES as readonly string[]).includes(ext)) {
    throw new ValidationError(`Unsupported file type. Supported: ${SUPPORTED_TYPES.join(", ")}`);
  }
  if (bytes.length === 0) throw new ValidationError("The file is empty");
  if (bytes.length > MAX_IMPORT_BYTES) throw new ValidationError("File is too large (max 2 MB)");

  let html: string;
  if (ext === ".txt") {
    html = textToHtml(bytes.toString("utf8"));
  } else if (ext === ".md") {
    // Raw HTML in markdown is harmless: it goes through the editor schema below,
    // which drops anything it doesn't model (script, iframe, style, ...).
    html = await marked.parse(bytes.toString("utf8"), { async: true });
  } else {
    if (bytes.subarray(0, 2).toString("latin1") !== "PK") {
      throw new ValidationError("This doesn't look like a valid .docx file");
    }
    try {
      // mammoth drops underline unless it is explicitly mapped
      html = (await mammoth.convertToHtml({ buffer: bytes }, { styleMap: ["u => u"] })).value;
    } catch {
      throw new ValidationError("Could not read this .docx file. It may be corrupt");
    }
  }

  if (!html.trim()) throw new ValidationError("No text content found in the file");
  const content = generateJSON(html, editorExtensions) as Node;
  validateContent(content); // size + shape guard
  return { title: titleFrom(name), content };
}
