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
    const big = (n: number) => ({ type: "doc", content: [{ type: "text", text: "a".repeat(n) }] });
    expect(() => validateContent(big(MAX_CONTENT_BYTES))).toThrow(/1 MB/);
    expect(() => validateContent(big(MAX_CONTENT_BYTES - 1000))).not.toThrow();
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
