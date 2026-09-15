import { z } from "zod";
import { requireUser, verifyPin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, tooManyRequests, unauthorized } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";

const schema = z.object({ pin: z.string().min(4).max(12) });

export async function POST(request: Request) {
  const ip = await getRequestIp();
  const rate = enforceRateLimit(`verify-pin:${ip}`, 12, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid PIN format");

  const valid = await verifyPin(parsed.data.pin, user.pinHash ?? null);
  if (!valid) {
    await logAudit({ actorUserId: user.id, action: "PIN_VERIFY_FAILED", entityType: "security", ipAddress: ip });
    return unauthorized();
  }

  await logAudit({ actorUserId: user.id, action: "PIN_VERIFY_SUCCESS", entityType: "security", ipAddress: ip });
  return ok({ ok: true });
}
