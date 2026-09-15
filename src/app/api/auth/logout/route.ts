import { clearSession, getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { ok } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

export async function POST() {
  const user = await getCurrentUser();
  await clearSession();
  if (user) {
    await logAudit({ actorUserId: user.id, action: "LOGOUT", entityType: "auth", ipAddress: await getRequestIp() });
  }
  return ok({ ok: true });
}
