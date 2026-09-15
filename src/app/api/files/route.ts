import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ok, unauthorized, badRequest } from "@/lib/http";
import { getOffset, parsePage, parsePageSize } from "@/lib/pagination";
import { getRequestIp } from "@/lib/request";

const allowedSort = {
  createdAt: files.createdAt,
  originalName: files.originalName,
  sizeBytes: files.sizeBytes,
} as const;

const deleteSchema = z.object({ ids: z.array(z.string().uuid()).min(1) });

export async function GET(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const clientId = searchParams.get("clientId") ?? "all";
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = parsePage(searchParams.get("page"));
  const sortBy = (searchParams.get("sortBy") ?? "createdAt") as keyof typeof allowedSort;
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";

  const clauses = [];
  if (search) {
    clauses.push(or(ilike(files.originalName, `%${search}%`), ilike(files.mimeType, `%${search}%`)));
  }
  if (clientId !== "all") {
    if (clientId === "unmatched") {
      clauses.push(isNull(files.clientId));
    } else {
      clauses.push(eq(files.clientId, clientId));
    }
  }

  const whereClause = clauses.length ? and(...clauses) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(files).where(whereClause);

  const offset = getOffset(page, pageSize);
  const orderColumn = allowedSort[sortBy] ?? files.createdAt;

  const rows = await db
    .select({
      id: files.id,
      clientId: files.clientId,
      originalName: files.originalName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      extension: files.extension,
      storagePath: files.storagePath,
      thumbnailPath: files.thumbnailPath,
      status: files.status,
      createdAt: files.createdAt,
      clientName: clients.name,
    })
    .from(files)
    .leftJoin(clients, eq(files.clientId, clients.id))
    .where(whereClause)
    .orderBy(direction === "asc" ? asc(orderColumn) : desc(orderColumn), asc(files.id))
    .limit(pageSize === "all" ? 5000 : pageSize)
    .offset(offset);

  return ok({ items: rows, total, page, pageSize, offset });
}

export async function DELETE(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid deletion payload");

  const deleted = await db.delete(files).where(inArray(files.id, parsed.data.ids)).returning({ id: files.id });
  await logAudit({
    actorUserId: user.id,
    action: "FILES_BULK_DELETE",
    entityType: "file",
    ipAddress: await getRequestIp(),
    metadata: { requested: parsed.data.ids.length, deleted: deleted.length },
  });
  return ok({ deletedIds: deleted.map((d) => d.id) });
}
