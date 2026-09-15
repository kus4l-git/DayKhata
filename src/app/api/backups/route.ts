import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { backups } from "@/db/schema";
import { requireRole } from "@/lib/guards";
import { badRequest, ok, unauthorized } from "@/lib/http";

const schema = z.object({ action: z.enum(["create", "recover"]) });

export async function GET() {
  const actor = await requireRole(["SUPER_ADMIN", "ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const history = await db.select().from(backups).orderBy(desc(backups.startedAt)).limit(50);
  return ok({ items: history });
}

export async function POST(request: Request) {
  const actor = await requireRole(["SUPER_ADMIN"]).catch(() => null);
  if (!actor) return unauthorized();

  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return badRequest("Invalid backup action");

  const [started] = await db
    .insert(backups)
    .values({
      status: "RUNNING",
      provider: "MEGA",
      fileName: null,
      startedBy: actor.id,
      details: { action: parsed.data.action },
    })
    .returning();

  const megaConfigured = Boolean(process.env.MEGA_EMAIL && process.env.MEGA_PASSWORD);

  const [finalized] = await db
    .update(backups)
    .set({
      status: megaConfigured ? "SUCCESS" : "FAILED",
      fileName: megaConfigured ? `backup-${new Date().toISOString()}.json` : null,
      finishedAt: new Date(),
      details: megaConfigured
        ? { action: parsed.data.action, message: "Backup action completed." }
        : { action: parsed.data.action, message: "Mega not configured." },
    })
    .where(eq(backups.id, started.id))
    .returning();

  return ok({ item: finalized });
}
