import { count, desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, backups, clients, credentials, files, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const [clientsCount] = await db.select({ total: count() }).from(clients);
  const [filesCount] = await db.select({ total: count() }).from(files);
  const [credentialsCount] = await db.select({ total: count() }).from(credentials);
  const [usersCount] = await db.select({ total: count() }).from(users);

  const recentAudit = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(8);
  const recentBackups = await db.select().from(backups).orderBy(desc(backups.startedAt)).limit(4);

  return ok({
    stats: {
      clients: clientsCount.total,
      files: filesCount.total,
      credentials: credentialsCount.total,
      users: usersCount.total,
    },
    recentAudit,
    recentBackups,
  });
}
