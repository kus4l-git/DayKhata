import bcrypt from "bcryptjs";
import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getOffset, parsePage, parsePageSize } from "@/lib/pagination";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["ADMIN", "STAFF"]),
  password: z.string().min(8),
  pin: z.string().min(4).max(12),
});

export async function GET(request: Request) {
  const actor = await requireRole(["SUPER_ADMIN", "ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = parsePage(searchParams.get("page"));
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";

  const whereClause = search
    ? or(ilike(users.name, `%${search}%`), ilike(users.email, `%${search}%`), ilike(users.role, `%${search}%`))
    : undefined;

  const [{ total }] = await db.select({ total: count() }).from(users).where(whereClause);
  const offset = getOffset(page, pageSize);

  const items = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(direction === "asc" ? asc(users.createdAt) : desc(users.createdAt), asc(users.id))
    .limit(pageSize === "all" ? 5000 : pageSize)
    .offset(offset);

  return ok({ items, total, page, pageSize, offset });
}

export async function POST(request: Request) {
  const actor = await requireRole(["SUPER_ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid user payload");

  const existing = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email.toLowerCase()) });
  if (existing) return badRequest("Email already in use");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const pinHash = await bcrypt.hash(parsed.data.pin, 10);

  const [created] = await db
    .insert(users)
    .values({
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash,
      pinHash,
      isActive: true,
    })
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive, createdAt: users.createdAt });

  return ok({ item: created }, { status: 201 });
}
