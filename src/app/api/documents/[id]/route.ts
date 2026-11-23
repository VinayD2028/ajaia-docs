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
  const db = getDb();
  const access = getAccess(db, id, user.id);
  // 404 (not 403) when no access, so ids of other users' docs aren't leaked.
  if (!access) return err("Document not found", 404);
  const doc = getDocument(db, id)!;
  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      content: JSON.parse(doc.content_json),
      owner_name: doc.owner_name,
      created_at: doc.created_at,
      updated_at: doc.updated_at,
    },
    access,
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const db = getDb();
  const access = getAccess(db, id, user.id);
  if (!access) return err("Document not found", 404);
  if (!canEdit(access)) return err("You have view-only access", 403);
  try {
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["title", "content"]);
    if (body.title === undefined && body.content === undefined) {
      throw new ValidationError("Provide title and/or content");
    }
    // Validate everything before writing anything.
    const title = body.title === undefined ? undefined : validateTitle(body.title);
    const contentJson = body.content === undefined ? undefined : validateContent(body.content);
    if (title !== undefined) renameDocument(db, id, title);
    if (contentJson !== undefined) saveContent(db, id, contentJson);
    return NextResponse.json({ ok: true, updated_at: getDocument(db, id)!.updated_at });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  const { id } = await params;
  const db = getDb();
  const access = getAccess(db, id, user.id);
  if (!access) return err("Document not found", 404);
  if (access !== "owner") return err("Only the owner can delete a document", 403);
  deleteDocument(db, id);
  return NextResponse.json({ ok: true });
}
