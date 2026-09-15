import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const items = await db
    .select({ id: clients.id, name: clients.name, tpin: clients.tpin })
    .from(clients)
    .orderBy(asc(clients.name))
    .limit(5000);

  return ok({ items });
}
