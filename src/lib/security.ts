import crypto from "node:crypto";

export function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomToken(size = 48) {
  return crypto.randomBytes(size).toString("hex");
}

export function generateResetCode64() {
  return crypto.randomBytes(32).toString("hex");
}

export function timingSafeEqual(a: string, b: string) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}
