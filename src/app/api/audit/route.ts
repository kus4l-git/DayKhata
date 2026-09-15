import { asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { ok, unauthorized } from "@/lib/http";
import { getOffset, parsePage, parsePageSize } from "@/lib/pagination";

export async function GET(request: Request) {
  const actor = await requireRole(["SUPER_ADMIN", "ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const { searchParams } = new URL(request.url);
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = parsePage(searchParams.get("page"));
  const search = searchParams.get("search")?.trim() ?? "";
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";

  const whereClause = search
    ? or(ilike(auditLogs.action, `%${search}%`), ilike(auditLogs.entityType, `%${search}%`), ilike(auditLogs.entityId, `%${search}%`))
    : undefined;

  const [{ total }] = await db.select({ total: count() }).from(auditLogs).where(whereClause);
  const offset = getOffset(page, pageSize);

  const items = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(whereClause)
    .orderBy(direction === "asc" ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt), asc(auditLogs.id))
    .limit(pageSize === "all" ? 5000 : pageSize)
    .offset(offset);

  return ok({ items, total, page, pageSize, offset });
}
