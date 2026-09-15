import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { credentials, users } from "@/db/schema";
import { requireUser, verifyPin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { decryptSecret } from "@/lib/crypto";
import { badRequest, ok, unauthorized, tooManyRequests } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";

const schema = z.object({ credentialId: z.string().uuid(), pin: z.string().min(4).max(12) });

export async function POST(request: Request) {
  const ip = await getRequestIp();
  const rate = enforceRateLimit(`credential-reveal:${ip}`, 10, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  const auth = await requireUser().catch(() => null);
  if (!auth) return unauthorized();

  const user = await db.query.users.findFirst({ where: eq(users.id, auth.id) });
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid reveal payload");

  const pinValid = await verifyPin(parsed.data.pin, user.pinHash ?? null);
  if (!pinValid) return unauthorized();

  const row = await db.query.credentials.findFirst({ where: eq(credentials.id, parsed.data.credentialId) });
  if (!row) return badRequest("Credential not found");

  const secret = decryptSecret(row.secretCiphertext);

  await logAudit({
    actorUserId: user.id,
    action: "CREDENTIAL_REVEAL",
    entityType: "credential",
    entityId: row.id,
    ipAddress: ip,
    metadata: { clientId: row.clientId },
  });

  return ok({ secret });
}
