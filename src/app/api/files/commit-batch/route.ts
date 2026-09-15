import { z } from "zod";
import { db } from "@/db";
import { files } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";
import { fileExtension } from "@/lib/storage";

const schema = z.object({
  /* clientId is now optional — null / absent means the file is unmatched */
  clientId: z.string().uuid().nullable().optional(),
  items: z
    .array(
      z.object({
        fileName:    z.string().min(1),
        objectPath:  z.string().min(1),
        contentType: z.string().min(1),
        sizeBytes:   z.number().nonnegative(),
        status:      z.enum(["READY", "FAILED"]),
        checksum:    z.string().optional(),
        provider:    z.enum(["supabase", "local"]),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid commit payload");

  const resolvedClientId = parsed.data.clientId ?? null;

  const inserted = await db
    .insert(files)
    .values(
      parsed.data.items.map((item) => ({
        clientId:        resolvedClientId,   /* null = unmatched */
        originalName:    item.fileName,
        mimeType:        item.contentType,
        sizeBytes:       item.sizeBytes,
        extension:       fileExtension(item.fileName),
        storagePath:     item.objectPath,
        thumbnailPath:   null,
        checksum:        item.checksum,
        status:          item.status,
        storageProvider: item.provider,
        uploadedBy:      user.id,
      })),
    )
    .returning();

  await logAudit({
    actorUserId: user.id,
    action:      "FILES_BATCH_COMMIT",
    entityType:  "file",
    ipAddress:   await getRequestIp(),
    metadata:    { count: inserted.length, clientId: resolvedClientId ?? "unmatched" },
  });

  return ok({ items: inserted });
}
