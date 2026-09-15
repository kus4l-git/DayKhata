import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  tpin: z.string().min(1).optional(),
  delegatedTo: z.string().optional().nullable(),
  delegatedStatus: z.enum(["UNASSIGNED", "LAST_ACTIVE", "INACTIVE", "WIP", "CUSTOM"]).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { id } = await params;
  const payload = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return badRequest("Invalid client payload");

  const [updated] = await db
    .update(clients)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(clients.id, id))
    .returning();

  if (!updated) return badRequest("Client not found");

  await logAudit({ actorUserId: user.id, action: "CLIENT_UPDATED", entityType: "client", entityId: id, ipAddress: await getRequestIp() });
  return ok({ item: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { id } = await params;

  const [deleted] = await db.delete(clients).where(eq(clients.id, id)).returning({ id: clients.id });
  if (!deleted) return badRequest("Client not found");

  await logAudit({ actorUserId: user.id, action: "CLIENT_DELETED", entityType: "client", entityId: id, ipAddress: await getRequestIp() });
  return ok({ ok: true });
}
