import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { buildDownloadUrl } from "@/lib/storage";

const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid download payload");

  const rows = await db
    .select({ 
      id: files.id, 
      name: files.originalName, 
      storagePath: files.storagePath,
    })
    .from(files)
    .where(inArray(files.id, parsed.data.ids));

  // Build download URLs (local-download endpoint handles both Supabase and local files)
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: buildDownloadUrl(r.storagePath),
  }));

  return ok({ items });
}
