/**
 * POST /api/files/rematch
 *
 * Looks at every file where clientId IS NULL and tries to match its
 * originalName against every client name using the same word-boundary
 * algorithm used on the frontend.  Returns counts of matched / skipped.
 *
 * Called automatically:
 *   - After a new client is created (from the clients page)
 *   - On demand from the files page toolbar
 */
import { eq, isNull, ilike } from "drizzle-orm";
import { db } from "@/db";
import { clients, files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

/** Identical scoring logic to the frontend autoMatchClient() */
function matchClientForFile(
  fileName: string,
  clientList: Array<{ id: string; name: string }>,
): string | null {
  const lower = fileName.toLowerCase().replace(/[-_.()\[\]]/g, " ");
  let best: { id: string; score: number } | null = null;

  for (const c of clientList) {
    const parts = c.name
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    const matched = parts.every((p) => lower.includes(p));
    if (matched) {
      const score = parts.reduce((s, p) => s + p.length, 0);
      if (!best || score > best.score) best = { id: c.id, score };
    }
  }

  return best ? best.id : null;
}

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  /* 1. Load all clients */
  const allClients = await db
    .select({ id: clients.id, name: clients.name })
    .from(clients);

  if (allClients.length === 0) return ok({ matched: 0, skipped: 0 });

  /* 2. Load all unmatched files */
  const unmatched = await db
    .select({ id: files.id, originalName: files.originalName })
    .from(files)
    .where(isNull(files.clientId));

  if (unmatched.length === 0) return ok({ matched: 0, skipped: 0 });

  /* 3. For each unmatched file, try to find a client */
  let matched = 0;
  let skipped = 0;

  for (const file of unmatched) {
    const clientId = matchClientForFile(file.originalName, allClients);

    if (clientId) {
      await db
        .update(files)
        .set({ clientId, updatedAt: new Date() })
        .where(eq(files.id, file.id));
      matched++;
    } else {
      skipped++;
    }
  }

  if (matched > 0) {
    await logAudit({
      actorUserId: user.id,
      action:      "FILES_REMATCH",
      entityType:  "file",
      ipAddress:   await getRequestIp(),
      metadata:    { matched, skipped },
    });
  }

  return ok({ matched, skipped });
}
