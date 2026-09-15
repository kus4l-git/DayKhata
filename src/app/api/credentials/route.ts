import { and, asc, count, desc, eq, ilike, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, credentials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getOffset, parsePage, parsePageSize } from "@/lib/pagination";

const schema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(1),
  username: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  secret: z.string().min(1),
  notes: z.string().optional().nullable(),
});

export async function GET(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const clientId = searchParams.get("clientId") ?? "all";
  const pageSize = parsePageSize(searchParams.get("pageSize"));
  const page = parsePage(searchParams.get("page"));
  const direction = searchParams.get("direction") === "asc" ? "asc" : "desc";

  const clauses = [];
  if (search) {
    clauses.push(or(ilike(credentials.title, `%${search}%`), ilike(credentials.username, `%${search}%`), ilike(credentials.email, `%${search}%`)));
  }
  if (clientId !== "all") {
    clauses.push(eq(credentials.clientId, clientId));
  }

  const whereClause = clauses.length ? and(...clauses) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(credentials).where(whereClause);
  const offset = getOffset(page, pageSize);

  const items = await db
    .select({
      id:         credentials.id,
      clientId:   credentials.clientId,
      clientName: clients.name,
      clientIp:   clients.ipAddress,
      title:      credentials.title,
      username:   credentials.username,
      email:      credentials.email,
      notes:      credentials.notes,
      createdAt:  credentials.createdAt,
    })
    .from(credentials)
    .leftJoin(clients, eq(credentials.clientId, clients.id))
    .where(whereClause)
    .orderBy(direction === "asc" ? asc(credentials.createdAt) : desc(credentials.createdAt), asc(credentials.id))
    .limit(pageSize === "all" ? 5000 : pageSize)
    .offset(offset);

  return ok({ items, total, page, pageSize, offset });
}

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid credential payload");

  const encrypted = encryptSecret(parsed.data.secret);

  const [created] = await db
    .insert(credentials)
    .values({
      clientId: parsed.data.clientId,
      title: parsed.data.title,
      username: parsed.data.username,
      email: parsed.data.email,
      secretCiphertext: encrypted,
      notes: parsed.data.notes,
      createdBy: user.id,
      updatedBy: user.id,
      updatedAt: new Date(),
    })
    .returning({
      id: credentials.id,
      clientId: credentials.clientId,
      title: credentials.title,
      username: credentials.username,
      email: credentials.email,
      notes: credentials.notes,
      createdAt: credentials.createdAt,
    });

  return ok({ item: created }, { status: 201 });
}
