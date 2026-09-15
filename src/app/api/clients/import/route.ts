import { z } from "zod";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { badRequest, ok, unauthorized } from "@/lib/http";
import { getRequestIp } from "@/lib/request";

/* ── CSV parser (handles quoted fields with commas / line-breaks) ── */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < lines.length) {
    const ch = lines[i];

    if (inQuotes) {
      if (ch === '"') {
        if (lines[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(field);
        field = "";
      } else if (ch === "\n") {
        row.push(field);
        field = "";
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
    i++;
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim()));
}

const DELEGATED_STATUSES = ["UNASSIGNED", "LAST_ACTIVE", "INACTIVE", "WIP", "CUSTOM"] as const;
type DelegatedStatus = (typeof DELEGATED_STATUSES)[number];

function toStatus(raw: string): DelegatedStatus {
  const upper = raw.toUpperCase().trim() as DelegatedStatus;
  return DELEGATED_STATUSES.includes(upper) ? upper : "UNASSIGNED";
}

const rowSchema = z.object({
  name: z.string().min(1),
  tpin: z.string().min(1),
  contact: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  ipAddress: z.string().optional().nullable(),
  delegatedTo: z.string().optional().nullable(),
  delegatedStatus: z.enum(DELEGATED_STATUSES).default("UNASSIGNED"),
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
    /* raw text body */
    csvText = await request.text().catch(() => "");
    if (!csvText.trim()) return badRequest("Empty CSV body");
  }

  const rows = parseCsv(csvText);
  if (rows.length < 2) return badRequest("CSV must have a header row and at least one data row");

  /* normalise header names: lowercase, strip spaces, underscores → camel */
  const rawHeaders = rows[0].map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));

  const idx = {
    name:             rawHeaders.indexOf("name"),
    tpin:             rawHeaders.indexOf("tpin"),
    contact:          rawHeaders.indexOf("contact"),
    address:          rawHeaders.indexOf("address"),
    ip_address:       rawHeaders.indexOf("ip_address"),
    delegated_to:     rawHeaders.indexOf("delegated_to"),
    delegated_status: rawHeaders.indexOf("delegated_status"),
  };

  if (idx.name === -1 || idx.tpin === -1) {
    return badRequest("CSV must contain at minimum 'name' and 'tpin' columns");
  }

  const get = (row: string[], i: number) => (i >= 0 ? row[i]?.trim() || null : null);

  const inserted: string[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];

    const raw = {
      name:            get(row, idx.name) ?? "",
      tpin:            get(row, idx.tpin) ?? "",
      contact:         get(row, idx.contact),
      address:         get(row, idx.address),
      ipAddress:       get(row, idx.ip_address),
      delegatedTo:     get(row, idx.delegated_to),
      delegatedStatus: toStatus(get(row, idx.delegated_status) ?? ""),
    };

    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: r + 1, message: parsed.error.issues[0]?.message ?? "Invalid row" });
      continue;
    }

    try {
      const [created] = await db
        .insert(clients)
        .values({ ...parsed.data, createdBy: user.id, updatedAt: new Date() })
        .returning({ id: clients.id });

      inserted.push(created.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Database error";
      errors.push({ row: r + 1, message: msg });
    }
  }

  if (inserted.length > 0) {
    await logAudit({
      actorUserId: user.id,
      action: "CLIENTS_IMPORTED",
      entityType: "client",
      ipAddress: await getRequestIp(),
      metadata: { count: inserted.length },
    });
  }

  return ok({ inserted: inserted.length, errors });
}
