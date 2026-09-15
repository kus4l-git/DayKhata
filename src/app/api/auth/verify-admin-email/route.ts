import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { passwordResetRequests, users } from "@/db/schema";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, tooManyRequests, unauthorized } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";
import { generateResetCode64 } from "@/lib/security";

const schema = z.object({ email: z.string().email() });

export async function POST(request: Request) {
  const ip = await getRequestIp();
  const rate = enforceRateLimit(`verify-admin:${ip}`, 6, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid email");

  const user = await db.query.users.findFirst({
    where: and(eq(users.email, parsed.data.email.toLowerCase()), eq(users.role, "SUPER_ADMIN"), eq(users.isActive, true)),
  });

  if (!user) {
    await logAudit({ action: "RESET_VERIFY_ADMIN_FAILED", entityType: "auth", ipAddress: ip, metadata: { email: parsed.data.email } });
    return unauthorized();
  }

  const code = generateResetCode64();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  await db.insert(passwordResetRequests).values({ userId: user.id, codeHash, expiresAt });
  await logAudit({ actorUserId: user.id, action: "RESET_CODE_GENERATED", entityType: "auth", ipAddress: ip });

  return ok({ ok: true, resetCode: code, expiresAt: expiresAt.toISOString() });
}
