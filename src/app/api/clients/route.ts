import { and, asc, count, desc, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getOffset, parsePage, parsePageSize } from "@/lib/pagination";
import { getRequestIp } from "@/lib/request";

const createSchema = z.object({
  name: z.string().min(1),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  tpin: z.string().min(1),
  delegatedTo: z.string().optional().nullable(),
  delegatedStatus: z.enum(["UNASSIGNED", "LAST_ACTIVE", "INACTIVE", "WIP", "CUSTOM"]).optional(),
});

const allowedSort: Record<string, typeof clients.createdAt | typeof clients.name | typeof clients.updatedAt> = {
  createdAt: clients.createdAt,
  name: clients.name,
  updatedAt: clients.updatedAt,
};

export async function GET(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = parsePage(searchParams.get("page"));
  const delegatedStatus = searchParams.get("delegatedStatus") ?? "all";
  const sortBy = searchParams.get("sortBy") ?? "createdAt";
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";

  const searchClause = search
    ? or(ilike(clients.name, `%${search}%`), ilike(clients.contact, `%${search}%`), ilike(clients.tpin, `%${search}%`))
    : undefined;

  const delegatedClause = delegatedStatus !== "all" ? sql`${clients.delegatedStatus} = ${delegatedStatus}` : undefined;

  const whereClause = and(searchClause, delegatedClause);

  const [{ total }] = await db.select({ total: count() }).from(clients).where(whereClause);

  const offset = getOffset(page, pageSize);
  const sortable = allowedSort[sortBy] ?? clients.createdAt;

  const rows = await db
    .select()
    .from(clients)
    .where(whereClause)
    .orderBy(direction === "asc" ? asc(sortable) : desc(sortable), asc(clients.id))
    .limit(pageSize === "all" ? 5000 : pageSize)
    .offset(offset);

  return ok({ items: rows, total, page, pageSize, offset });
}

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const payload = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(payload);
  if (!parsed.success) return badRequest("Invalid client payload");

  const [created] = await db
    .insert(clients)
    .values({ ...parsed.data, createdBy: user.id, updatedAt: new Date() })
    .returning();

  await logAudit({
    actorUserId: user.id,
    action: "CLIENT_CREATED",
    entityType: "client",
    entityId: created.id,
    ipAddress: await getRequestIp(),
  });

  return ok({ item: created }, { status: 201 });
}
