import { generateJSON } from "@tiptap/html/server";
import mammoth from "mammoth";
import { marked } from "marked";
import { editorExtensions } from "./extensions";
import { validateContent, ValidationError } from "./validate";

export const SUPPORTED_TYPES = [".txt", ".md", ".docx"] as const;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
/** HTML->JSON conversion cost grows faster than file size; bound the element count first. */
export const MAX_IMPORT_ELEMENTS = 20_000;

type Node = Record<string, unknown>;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function textToHtml(text: string): string {
  const paras = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paras.length > MAX_IMPORT_ELEMENTS) tooComplex();
  return paras.map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("");
}

function tooComplex(): never {
  throw new ValidationError(`This file has too many paragraphs or elements to import (max ${MAX_IMPORT_ELEMENTS.toLocaleString("en-US")})`);
}

/** Strict UTF-8 text only: binary or UTF-16 files renamed to .txt are rejected, not mangled. */
function decodeText(bytes: Buffer): string {
  if (bytes.includes(0)) throw new ValidationError("This doesn't look like a UTF-8 text file");
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    throw new ValidationError("This file is not valid UTF-8 text. Re-save it as UTF-8 and try again");
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function titleFrom(name: string): string {
  const base = name.replace(/^.*[\\/]/, "").replace(/\.[^.]+$/, "").trim();
  return (base.replace(/\u0000/g, "") || "Imported document").slice(0, 200);
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
    html = textToHtml(decodeText(bytes));
  } else if (ext === ".md") {
    // Raw HTML in markdown is harmless: it goes through the editor schema below,
    // which drops anything it doesn't model (script, iframe, style, ...).
    html = await marked.parse(decodeText(bytes), { async: true });
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

  if ((html.match(/<[a-z]/gi)?.length ?? 0) > MAX_IMPORT_ELEMENTS) tooComplex();
  if (!html.trim()) throw new ValidationError("No text content found in the file");
  const content = generateJSON(html, editorExtensions) as Node;
  validateContent(content); // size + shape guard
  return { title: titleFrom(name), content };
}
