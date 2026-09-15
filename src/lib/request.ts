import { headers } from "next/headers";

export async function getRequestIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}
