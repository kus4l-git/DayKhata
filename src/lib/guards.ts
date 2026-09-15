import { requireUser } from "@/lib/auth";

export async function requireRole(roles: Array<"SUPER_ADMIN" | "ADMIN" | "STAFF">) {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
