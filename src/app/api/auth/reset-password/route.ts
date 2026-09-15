import bcrypt from "bcryptjs";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetRequests, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, tooManyRequests, unauthorized } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";

const schema = z.object({
  email: z.string().email(),
  resetCode: z.string().length(64),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = await getRequestIp();
  const rate = enforceRateLimit(`reset-password:${ip}`, 6, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid reset payload");

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email.toLowerCase()) });
  if (!user) return unauthorized();

  const resetRequest = await db.query.passwordResetRequests.findFirst({
    where: and(eq(passwordResetRequests.userId, user.id), gt(passwordResetRequests.expiresAt, new Date()), isNull(passwordResetRequests.consumedAt)),
    orderBy: [desc(passwordResetRequests.createdAt)],
  });

  if (!resetRequest) return unauthorized();

  const codeValid = await bcrypt.compare(parsed.data.resetCode, resetRequest.codeHash);
  if (!codeValid) {
    await logAudit({ actorUserId: user.id, action: "RESET_CODE_INVALID", entityType: "auth", ipAddress: ip });
    return unauthorized();
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
  await db.update(passwordResetRequests).set({ consumedAt: new Date() }).where(eq(passwordResetRequests.id, resetRequest.id));

  await logAudit({ actorUserId: user.id, action: "PASSWORD_RESET_SUCCESS", entityType: "auth", ipAddress: ip });
  return ok({ ok: true });
}
