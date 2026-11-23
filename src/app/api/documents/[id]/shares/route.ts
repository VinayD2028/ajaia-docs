import { NextResponse } from "next/server";
import { err, handleError, readJsonObject } from "@/lib/http";
import { requireOwner } from "@/lib/ownerRoute";
import { findUserByEmail, listShares, upsertShare } from "@/lib/shares";
import { rejectUnknownFields, validateEmail, validatePermission } from "@/lib/validate";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const guard = await requireOwner(id);
  if (guard instanceof NextResponse) return guard;
  return NextResponse.json({ shares: listShares(guard.db, id) });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const guard = await requireOwner(id);
  if (guard instanceof NextResponse) return guard;
  try {
    const body = await readJsonObject(req);
    rejectUnknownFields(body, ["email", "permission"]);
    const email = validateEmail(body.email);
    const permission = validatePermission(body.permission);
    const target = findUserByEmail(guard.db, email);
    if (!target) return err("No user with that email", 404);
    if (target.id === guard.user.id) return err("You already own this document", 400);
    upsertShare(guard.db, id, target.id, permission);
    return NextResponse.json({ shares: listShares(guard.db, id) }, { status: 201 });
  } catch (e) {
    return handleError(e);
  }
}
