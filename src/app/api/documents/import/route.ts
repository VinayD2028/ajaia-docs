import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { createDocument } from "@/lib/documents";
import { err, handleError, requireUser } from "@/lib/http";
import { importFile, MAX_IMPORT_BYTES } from "@/lib/import";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const user = await requireUser();
  if (user instanceof NextResponse) return user;
  try {
    // Cheap early rejection before buffering a huge body.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_IMPORT_BYTES + 64 * 1024) return err("File is too large (max 2 MB)", 413);

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return err("Expected multipart/form-data with a 'file' field", 400);
    }
    const file = form.get("file");
    if (!(file instanceof File)) return err("Missing 'file' field", 400);

    const { title, content } = await importFile(file.name, Buffer.from(await file.arrayBuffer()));
    const id = await createDocument(await getDb(), user.id, title, JSON.stringify(content));
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
