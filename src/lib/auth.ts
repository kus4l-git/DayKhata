import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/security";

const SESSION_COOKIE = "pm_session";
const SESSION_DAYS = 14;

export async function ensureSuperAdmin() {
  const existing = await db.query.users.findFirst({ where: eq(users.role, "SUPER_ADMIN") });
  if (existing) return existing;

  const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";
  const name = process.env.SUPER_ADMIN_NAME ?? "Super Admin";
  const pin = process.env.SUPER_ADMIN_PIN ?? "1234";

  const passwordHash = await bcrypt.hash(password, 10);
  const pinHash = await bcrypt.hash(pin, 10);

  const [created] = await db
    .insert(users)
    .values({ email: email.toLowerCase(), name, passwordHash, role: "SUPER_ADMIN", pinHash, isActive: true })
    .returning();

  return created;
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function verifyPin(pin: string, pinHash: string | null) {
  if (!pinHash) return false;
  return bcrypt.compare(pin, pinHash);
}

export async function createSession(userId: string) {
  const token = randomToken(32);
  const tokenHash = sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(sessions).values({ userId, tokenHash, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = sha256(token);
  const session = await db.query.sessions.findFirst({
    where: and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
    with: { user: true },
  });

  if (!session?.user || !session.user.isActive) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
