import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importFile, MAX_IMPORT_BYTES } from "@/lib/import";
import { ValidationError } from "@/lib/validate";

const fixture = (n: string) => fs.readFileSync(path.join(__dirname, "fixtures", n));

type N = { type?: string; marks?: { type: string }[]; content?: N[] };
const collect = (n: N, acc = new Set<string>()): Set<string> => {
  if (n.type) acc.add(n.type);
  n.marks?.forEach((m) => acc.add(`mark:${m.type}`));
  n.content?.forEach((c) => collect(c, acc));
  return acc;
};

describe("importFile", () => {
  it("txt: paragraphs on blank lines, hard breaks on single newlines, literal angle brackets", async () => {
    const { title, content } = await importFile("sample.txt", fixture("sample.txt"));
    const json = JSON.stringify(content);
    expect(title).toBe("sample");
    expect((content as N).content!.filter((n) => n.type === "paragraph")).toHaveLength(3);
    expect(collect(content as N).has("hardBreak")).toBe(true);
    expect(json).toContain("<b>paragraph</b>"); // shown as text, not interpreted as bold
    expect(collect(content as N).has("mark:bold")).toBe(false);
  });

  it("md: heading, bold, italic, bullet and numbered lists; raw <script> is dropped", async () => {
    const { content } = await importFile("sample.md", fixture("sample.md"));
    const types = collect(content as N);
    for (const t of ["heading", "mark:bold", "mark:italic", "bulletList", "orderedList"]) expect(types.has(t)).toBe(true);
    expect(JSON.stringify(content)).not.toMatch(/script|alert/i);
  });

  it("docx: heading, bold, italic, underline, lists", async () => {
    const { title, content } = await importFile("Quarterly.DOCX", fixture("sample.docx"));
    const types = collect(content as N);
    for (const t of ["heading", "mark:bold", "mark:italic", "mark:underline", "bulletList", "orderedList"]) {
      expect(types.has(t), t).toBe(true);
    }
    expect(title).toBe("Quarterly"); // extension match is case-insensitive
  });

  it("derives a safe title: strips directories, truncates, falls back when empty", async () => {
    const txt = Buffer.from("hello");
    expect((await importFile("C:\\docs\\notes.v2.txt", txt)).title).toBe("notes.v2");
    expect((await importFile(`${"x".repeat(300)}.txt`, txt)).title).toHaveLength(200);
    expect((await importFile(".txt", txt)).title).toBe("Imported document");
  });

  it.each([
    ["wrong extension", "a.pdf", Buffer.from("x"), /Unsupported/],
    ["no extension", "README", Buffer.from("x"), /Unsupported/],
    ["empty file", "a.txt", Buffer.alloc(0), /empty/],
    ["whitespace-only txt", "a.txt", Buffer.from("  \n\n "), /No text/],
    ["oversize", "a.txt", Buffer.alloc(MAX_IMPORT_BYTES + 1, 97), /too large/],
    ["docx without zip signature", "a.docx", Buffer.from("not a zip file"), /valid \.docx/],
    ["docx that is a zip but not a docx", "a.docx", Buffer.from("PK\u0003\u0004garbage"), /Could not read/],
  ])("rejects %s with a ValidationError", async (_label, name, bytes, msg) => {
    const p = importFile(name, bytes);
    await expect(p).rejects.toBeInstanceOf(ValidationError);
    await expect(p).rejects.toThrow(msg);
  });

  it("rejects files with too many paragraphs quickly instead of hanging (QA-001)", async () => {
    const lines = Buffer.from("a\n\n".repeat(25_000));
    const t0 = Date.now();
    await expect(importFile("many.txt", lines)).rejects.toThrow(/too many/);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("accepts a large-but-reasonable file just under the element cap", async () => {
    const t0 = Date.now();
    const { content } = await importFile("big.txt", Buffer.from("a\n\n".repeat(15_000)));
    expect((content as N).content!.length).toBe(15_000);
    expect(Date.now() - t0).toBeLessThan(15_000);
  });

  it("rejects binary and UTF-16 files named .txt instead of mangling them (QA-009)", async () => {
    await expect(importFile("bin.txt", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]))).rejects.toThrow(/UTF-8/);
    await expect(importFile("u16.txt", Buffer.from("\ufeffhello", "utf16le"))).rejects.toThrow(/UTF-8/);
    await expect(importFile("latin1.txt", Buffer.from("caf\xe9 au lait", "latin1"))).rejects.toThrow(/UTF-8/);
  });

  it("accepts UTF-8 with a BOM and strips it", async () => {
    const { content } = await importFile("bom.txt", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("héllo")]));
    expect(JSON.stringify(content)).toContain("héllo");
    expect(JSON.stringify(content)).not.toContain("\ufeff");
  });
});
