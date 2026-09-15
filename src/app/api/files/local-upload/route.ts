import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { badRequest, ok, unauthorized } from "@/lib/http";

const baseDir = path.join(process.cwd(), ".uploads");

export async function PUT(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const objectPath = searchParams.get("path");
  if (!objectPath) return badRequest("Missing path");

  const arrayBuffer = await request.arrayBuffer();
  const fullPath = path.join(baseDir, objectPath);
  await mkdir(path.dirname(fullPath), { recursive: true });
  await writeFile(fullPath, Buffer.from(arrayBuffer));

  return ok({ ok: true });
}
