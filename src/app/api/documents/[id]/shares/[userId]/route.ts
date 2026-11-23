import { NextResponse } from "next/server";
import { err, handleError, readJsonObject } from "@/lib/http";
import { requireOwner } from "@/lib/ownerRoute";
import { listShares, removeShare, upsertShare } from "@/lib/shares";
import { rejectUnknownFields, validatePermission } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, userId } = await params;
  const guard = await requireOwner(id);
  if (guard instanceof NextResponse) return guard;
  if (!(await removeShare(guard.db, id, userId))) return err("That user does not have access", 404);
  return NextResponse.json({ shares: await listShares(guard.db, id) });
}

/** Change an existing collaborator's permission. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id, userId } = await params;
  const guard = await requireOwner(id);
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["permission"]);
    const permission = validatePermission(body.permission);
    if (!(await listShares(guard.db, id)).some((s) => s.user_id === userId)) {
      return err("That user does not have access", 404);
    }
    await upsertShare(guard.db, id, userId, permission);
    return NextResponse.json({ shares: await listShares(guard.db, id) });
  } catch (e) {
    return handleError(e);
  }
}
