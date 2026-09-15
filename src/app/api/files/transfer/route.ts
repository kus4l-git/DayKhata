import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

const schema = z.object({
  fileIds: z.array(z.string().uuid()).min(1),
  targetClientId: z.string().uuid(),
});

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid transfer payload");

  const updated = await db
    .update(files)
    .set({ clientId: parsed.data.targetClientId, updatedAt: new Date() })
    .where(and(inArray(files.id, parsed.data.fileIds), eq(files.status, "READY")))
    .returning({ id: files.id, clientId: files.clientId });

  await logAudit({
    actorUserId: user.id,
    action: "FILES_TRANSFER",
    entityType: "file",
    ipAddress: await getRequestIp(),
    metadata: { count: updated.length, targetClientId: parsed.data.targetClientId },
  });

  return ok({ items: updated });
}
