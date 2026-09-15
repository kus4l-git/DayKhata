import bcrypt from "bcryptjs";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { badRequest, forbidden, ok, unauthorized } from "@/lib/http";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  pin: z.string().min(4).max(12).optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["SUPER_ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid user payload");

  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return badRequest("User not found");

  if (target.role === "SUPER_ADMIN") {
    if (parsed.data.role && parsed.data.role !== "SUPER_ADMIN") return forbidden();
    if (parsed.data.isActive === false) return forbidden();
  }

  if (parsed.data.role === "SUPER_ADMIN") {
    const existingSuper = await db.query.users.findFirst({ where: and(eq(users.role, "SUPER_ADMIN"), ne(users.id, id)) });
    if (existingSuper) return forbidden();
  }

  const updateData: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  delete updateData.password;
  delete updateData.pin;

  if (parsed.data.password) updateData.passwordHash = await bcrypt.hash(parsed.data.password, 10);
  if (parsed.data.pin) updateData.pinHash = await bcrypt.hash(parsed.data.pin, 10);

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive, createdAt: users.createdAt });

  return ok({ item: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requireRole(["SUPER_ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const { id } = await params;
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!target) return badRequest("User not found");
  if (target.role === "SUPER_ADMIN") return forbidden();

  await db.delete(users).where(eq(users.id, id));
  return ok({ ok: true });
}
