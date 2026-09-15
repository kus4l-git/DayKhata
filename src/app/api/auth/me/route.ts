import { getCurrentUser } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/http";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return ok({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
}
