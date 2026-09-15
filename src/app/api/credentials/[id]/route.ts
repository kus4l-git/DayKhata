import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { credentials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { badRequest, ok, unauthorized } from "@/lib/http";

const schema = z.object({
  title: z.string().min(1).optional(),
  username: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  secret: z.string().min(1).optional(),
  notes: z.string().optional().nullable(),
  clientId: z.string().uuid().optional(),
});

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid credential payload");

  const updateData: Record<string, unknown> = { ...parsed.data, updatedBy: user.id, updatedAt: new Date() };
  delete updateData.secret;

  if (parsed.data.secret) {
    updateData.secretCiphertext = encryptSecret(parsed.data.secret);
  }

  const [updated] = await db
    .update(credentials)
    .set(updateData)
    .where(eq(credentials.id, id))
    .returning({
      id: credentials.id,
      clientId: credentials.clientId,
      title: credentials.title,
      username: credentials.username,
      email: credentials.email,
      notes: credentials.notes,
      createdAt: credentials.createdAt,
    });

  if (!updated) return badRequest("Credential not found");
  return ok({ item: updated });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { id } = await params;
  const [deleted] = await db.delete(credentials).where(eq(credentials.id, id)).returning({ id: credentials.id });
  if (!deleted) return badRequest("Credential not found");
  return ok({ ok: true });
}
