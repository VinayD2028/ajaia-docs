import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "@/lib/db";
import { createDocument, getDocument, listDocuments, renameDocument } from "@/lib/documents";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe("persistence (on-disk PGlite)", () => {
  it("keeps data across close/reopen; schema+seed are idempotent and never overwrite edits", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pgdata-"));
    dirs.push(dir);
    const target = path.join(dir, "db");

    const first = await openDatabase(target);
    const id = await createDocument(first, "u_alice", "Survives restart");
    await renameDocument(first, "d_sample", "Edited sample");
    await first.close();

    const second = await openDatabase(target); // re-runs schema + seed
    expect((await getDocument(second, id))?.title).toBe("Survives restart");
    expect((await getDocument(second, "d_sample"))?.title).toBe("Edited sample");
    const { owned } = await listDocuments(second, "u_alice");
    expect(owned.filter((d) => d.id === "d_sample")).toHaveLength(1);
    const [{ n }] = await second.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
    expect(n).toBe(3);
    await second.close();
  });
});
