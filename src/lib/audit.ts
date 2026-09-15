import { db } from "@/db";
import { auditLogs } from "@/db/schema";

export async function logAudit(params: {
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(auditLogs).values({
    actorUserId: params.actorUserId ?? null,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    ipAddress: params.ipAddress,
    metadata: params.metadata ?? {},
  });
}
