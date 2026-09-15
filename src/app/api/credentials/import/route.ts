import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clients, credentials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

/* ── CSV parser ── */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false;
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n") { row.push(field); field = ""; rows.push(row); row = []; }
      else { field += ch; }
    }
    i++;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

/* resolve client by name or UUID — case-insensitive name match */
async function resolveClient(nameOrId: string): Promise<string | null> {
  if (!nameOrId?.trim()) return null;

  /* try UUID exact match first */
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRe.test(nameOrId.trim())) {
    const found = await db.query.clients.findFirst({
      where: eq(clients.id, nameOrId.trim()),
      columns: { id: true },
    });
    return found?.id ?? null;
  }

  /* fuzzy name match */
  const found = await db.query.clients.findFirst({
    where: ilike(clients.name, nameOrId.trim()),
    columns: { id: true },
  });
  return found?.id ?? null;
}

const rowSchema = z.object({
  clientRef: z.string().min(1, "client_name is required"),
  title:     z.string().min(1, "title is required"),
  secret:    z.string().min(1, "secret is required"),
  username:  z.string().optional().nullable(),
  email:     z.string().optional().nullable(),
  notes:     z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const contentType = request.headers.get("content-type") ?? "";

  let csvText: string;
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return badRequest("Invalid form data");
    const file = form.get("file");
    if (!file || typeof file === "string") return badRequest("No file uploaded");
    csvText = await (file as File).text();
  } else {
    csvText = await request.text().catch(() => "");
    if (!csvText.trim()) return badRequest("Empty CSV body");
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) return badRequest("CSV must have a header row and at least one data row");

  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const idx = {
    client_name: rawHeaders.indexOf("client_name"),
    title:       rawHeaders.indexOf("title"),
    username:    rawHeaders.indexOf("username"),
    email:       rawHeaders.indexOf("email"),
    secret:      rawHeaders.indexOf("secret"),
    notes:       rawHeaders.indexOf("notes"),
  };

  if (idx.client_name === -1) return badRequest("CSV must contain a 'client_name' column");
  if (idx.title === -1)       return badRequest("CSV must contain a 'title' column");
  if (idx.secret === -1)      return badRequest("CSV must contain a 'secret' column");

  const get = (row: string[], i: number) => (i >= 0 ? row[i]?.trim() || null : null);

  const inserted: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const raw = {
      clientRef: get(row, idx.client_name) ?? "",
      title:     get(row, idx.title) ?? "",
      secret:    get(row, idx.secret) ?? "",
      username:  get(row, idx.username),
      email:     get(row, idx.email),
      notes:     get(row, idx.notes),
    };

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: r + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }

    const clientId = await resolveClient(parsed.data.clientRef);
    if (!clientId) {
      errors.push({ row: r + 1, message: `Client not found: "${parsed.data.clientRef}"` });
      continue;
    }

    try {
      const encrypted = encryptSecret(parsed.data.secret);

      const [created] = await db
        .insert(credentials)
        .values({
          clientId,
          title:            parsed.data.title,
          username:         parsed.data.username,
          email:            parsed.data.email,
          secretCiphertext: encrypted,
          notes:            parsed.data.notes,
          createdBy:        user.id,
          updatedBy:        user.id,
          updatedAt:        new Date(),
        })
        .returning({ id: credentials.id });

      inserted.push(created.id);
    } catch (e: unknown) {
      errors.push({ row: r + 1, message: e instanceof Error ? e.message : "Database error" });
    }
  }

  if (inserted.length > 0) {
    await logAudit({
      actorUserId: user.id,
      action: "CREDENTIALS_IMPORTED",
      entityType: "credential",
      ipAddress: await getRequestIp(),
      metadata: { count: inserted.length },
    });
  }

  return ok({ inserted: inserted.length, errors });
}
