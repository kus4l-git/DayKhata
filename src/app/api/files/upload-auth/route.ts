import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { badRequest, ok, tooManyRequests, unauthorized } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getRequestIp } from "@/lib/request";
import { createUploadAuthorizations } from "@/lib/storage";

const schema = z.object({
  /* clientId is now optional — null means "unmatched, store without a client" */
  clientId: z.string().uuid().nullable().optional(),
  files: z
    .array(
      z.object({
        localId: z.string().min(1),
        fileName: z.string().min(1),
        contentType: z.string().default("application/octet-stream"),
        sizeBytes: z.number().nonnegative(),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const ip   = await getRequestIp();
  const rate = enforceRateLimit(`upload-auth:${ip}`, 30, 60_000);
  if (!rate.allowed) return tooManyRequests(rate.resetAt);

  const body   = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid upload authorization payload");

  /* Use a sentinel folder name for unmatched files */
  const clientId = parsed.data.clientId ?? "unmatched";

  const auth = await createUploadAuthorizations(
    parsed.data.files.map((f) => ({
      localId:     f.localId,
      fileName:    f.fileName,
      contentType: f.contentType,
      clientId,
    })),
  );

  return ok({ items: auth });
}
