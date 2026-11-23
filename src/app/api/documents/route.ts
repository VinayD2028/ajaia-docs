import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDocument, listDocuments } from "@/lib/documents";
import { handleError, readJsonObject, requireUser } from "@/lib/http";
import { rejectUnknownFields, validateTitle } from "@/lib/validate";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  return NextResponse.json(await listDocuments(await getDb(), user.id));
}

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    // An empty body is fine: title defaults.
    const body = req.headers.get("content-length") === "0" ? {} : await readJsonObject(req);
    rejectUnknownFields(body, ["title"]);
    const title = body.title === undefined ? undefined : validateTitle(body.title);
    const id = await createDocument(await getDb(), user.id, title);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
