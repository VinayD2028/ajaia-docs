import { describe, expect, it } from "vitest";
import {
  MAX_CONTENT_BYTES, rejectUnknownFields, validateContent, validateEmail, validatePermission, validateTitle, ValidationError,
} from "@/lib/validate";

describe("validateTitle", () => {
  it("trims and accepts 1-200 characters", () => {
    expect(validateTitle("  Hello  ")).toBe("Hello");
    expect(validateTitle("a".repeat(200))).toHaveLength(200);
  });
  it.each([["", "empty"], ["   ", "whitespace only"], ["a".repeat(201), "too long"], [42, "non-string"], [null, "null"]])(
    "rejects %j (%s)", (...args) => expect(() => validateTitle(args[0])).toThrow(ValidationError)
  );
});

describe("validateContent", () => {
  it("accepts a TipTap doc and returns serialized JSON", () => {
    expect(JSON.parse(validateContent({ type: "doc", content: [] }))).toEqual({ type: "doc", content: [] });
  });
  it.each([[null], [[]], ["doc"], [{ type: "paragraph" }], [{}]])("rejects %j", (v) =>
    expect(() => validateContent(v)).toThrow(ValidationError)
  );
  it("rejects content over 1 MB but accepts just under", () => {
    const big = (n: number) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "a".repeat(n) }] }] });
    expect(() => validateContent(big(MAX_CONTENT_BYTES))).toThrow(/1 MB/);
    expect(() => validateContent(big(MAX_CONTENT_BYTES - 1000))).not.toThrow();
  });
});

describe("validateContent: schema and safety (QA-004)", () => {
  const p = (...content: object[]) => ({ type: "doc", content: [{ type: "paragraph", content }] });
  const t = (text: string, marks?: object[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
  it("accepts real editor output with marks, lists and headings", () => {
    const doc = { type: "doc", content: [
      { type: "heading", attrs: { level: 2 }, content: [t("H", [{ type: "bold" }])] },
      { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [t("x", [{ type: "link", attrs: { href: "https://a.co" } }])] }] }] },
    ] };
    expect(() => validateContent(doc)).not.toThrow();
  });
  it.each([
    ["unknown node type", { type: "doc", content: [{ type: "evil" }] }],
    ["unknown mark", p(t("x", [{ type: "nope" }]))],
    ["non-array content", { type: "doc", content: "oops" }],
    ["text directly under doc", { type: "doc", content: [{ type: "text", text: "a" }] }],
    ["javascript: link", p(t("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))],
    ["data: link", p(t("x", [{ type: "link", attrs: { href: "data:text/html,hi" } }]))],
    ["link without href", p(t("x", [{ type: "link", attrs: {} }]))],
  ])("rejects %s", (_n, v) => expect(() => validateContent(v)).toThrow(ValidationError));
  it("rejects deep nesting with a ValidationError, not a crash", () => {
    let node: object = { type: "paragraph" };
    for (let i = 0; i < 3000; i++) node = { type: "blockquote", content: [node] };
    expect(() => validateContent({ type: "doc", content: [node] })).toThrow(/nested too deeply/);
  });
});

describe("NUL handling (QA-003)", () => {
  it("rejects NUL in titles and emails", () => {
    expect(() => validateTitle("a\u0000b")).toThrow(ValidationError);
    expect(() => validateEmail("a\u0000@b.co")).toThrow(ValidationError);
  });
});

describe("other validators", () => {
  it("rejectUnknownFields names the offending keys", () => {
    expect(() => rejectUnknownFields({ title: "x", owner_id: "u_bob" }, ["title"])).toThrow(/owner_id/);
    expect(() => rejectUnknownFields({ title: "x" }, ["title", "content"])).not.toThrow();
  });
  it("validateEmail normalizes and rejects malformed input", () => {
    expect(validateEmail("  Bob@Example.com ")).toBe("bob@example.com");
    for (const bad of ["nope", "a@b", "a b@c.com", "", 5]) expect(() => validateEmail(bad)).toThrow(ValidationError);
  });
  it("validatePermission only allows view/edit", () => {
    expect(validatePermission("view")).toBe("view");
    expect(validatePermission("edit")).toBe("edit");
    expect(() => validatePermission("admin")).toThrow(ValidationError);
  });
});
