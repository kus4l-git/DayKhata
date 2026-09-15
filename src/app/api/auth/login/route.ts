import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, ensureSuperAdmin, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, tooManyRequests, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";
import { enforceRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: NextRequest) {
  const ip = await getRequestIp();
  const rate = enforceRateLimit(`login:${ip}`, 10, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  await ensureSuperAdmin();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid credentials format");

  const email = parsed.data.email.toLowerCase();
  const user = await db.query.users.findFirst({ where: and(eq(users.email, email), eq(users.isActive, true)) });
  if (!user) {
    await logAudit({ action: "LOGIN_FAILED", entityType: "auth", ipAddress: ip, metadata: { email } });
    return unauthorized();
  }

  if (user.lockoutUntil && user.lockoutUntil.getTime() > Date.now()) {
    return unauthorized();
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);

  if (!valid) {
    const nextAttempts = user.failedLoginAttempts + 1;
    const lockout = nextAttempts >= 3 ? new Date(Date.now() + 5 * 60_000) : null;
    await db
      .update(users)
      .set({
        failedLoginAttempts: nextAttempts >= 3 ? 0 : nextAttempts,
        lockoutUntil: lockout,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    await logAudit({ actorUserId: user.id, action: "LOGIN_FAILED", entityType: "auth", ipAddress: ip });
    return unauthorized();
  }

  await db.update(users).set({ failedLoginAttempts: 0, lockoutUntil: null, updatedAt: new Date() }).where(eq(users.id, user.id));
  await createSession(user.id);
  await logAudit({ actorUserId: user.id, action: "LOGIN_SUCCESS", entityType: "auth", ipAddress: ip });

  return ok({ ok: true, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
