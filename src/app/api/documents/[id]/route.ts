import { NextResponse } from "next/server";
import { canEdit, getAccess } from "@/lib/access";
import { getDb } from "@/lib/db";
import { deleteDocument, getDocument, renameDocument, saveContent } from "@/lib/documents";
import { err, handleError, readJsonObject, requireUser } from "@/lib/http";
import { rejectUnknownFields, validateContent, validateTitle, ValidationError } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const db = await getDb();
  const access = await getAccess(db, id, user.id);
  // 404 (not 403) when no access, so ids of other users' docs aren't leaked.
  if (!access) return err("Document not found", 404);
  const doc = (await getDocument(db, id))!;
  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      content: JSON.parse(doc.content_json),
      owner_name: doc.owner_name,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
      version: doc.version,
    },
    access,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const db = await getDb();
  const access = await getAccess(db, id, user.id);
  if (!access) return err("Document not found", 404);
  if (!canEdit(access)) return err("You have view-only access", 403);
  try {
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["title", "content", "baseVersion"]);
    if (body.title === undefined && body.content === undefined) {
      throw new ValidationError("Provide title and/or content");
    }
    // Validate everything before writing anything.
    const title = body.title === undefined ? undefined : validateTitle(body.title);
    const contentJson = body.content === undefined ? undefined : validateContent(body.content);
    const base = body.baseVersion;
    if (base !== undefined && (!Number.isInteger(base) || (base as number) < 1 || (base as number) > 2147483647)) {
      throw new ValidationError("baseVersion must be a positive integer");
    }
    if (contentJson !== undefined) {
      const version = await saveContent(db, id, contentJson, base as number | undefined);
      if (version === null) {
        const current = await getDocument(db, id);
        if (!current) return err("Document not found", 404);
        return NextResponse.json(
          { error: "This document was changed elsewhere. Reload to get the latest version.", version: current.version },
          { status: 409 }
        );
      }
      if (title !== undefined) await renameDocument(db, id, title);
      return NextResponse.json({ ok: true, version, updated_at: (await getDocument(db, id))!.updated_at });
    }
    if (title !== undefined) await renameDocument(db, id, title);
    const doc = (await getDocument(db, id))!;
    return NextResponse.json({ ok: true, version: doc.version, updated_at: doc.updated_at });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const db = await getDb();
  const access = await getAccess(db, id, user.id);
  if (!access) return err("Document not found", 404);
  if (access !== "owner") return err("Only the owner can delete a document", 403);
  await deleteDocument(db, id);
  return NextResponse.json({ ok: true });
}
