import { asc } from "drizzle-orm";
import { db } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

function escapeCsv(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const rows = await db
    .select()
    .from(clients)
    .orderBy(asc(clients.createdAt));

  const HEADERS = [
    "name",
    "tpin",
    "contact",
    "address",
    "ip_address",
    "delegated_to",
    "delegated_status",
  ];

  const lines: string[] = [HEADERS.join(",")];

  for (const r of rows) {
    lines.push(
      [
        escapeCsv(r.name),
        escapeCsv(r.tpin),
        escapeCsv(r.contact),
        escapeCsv(r.address),
        escapeCsv(r.ipAddress),
        escapeCsv(r.delegatedTo),
        escapeCsv(r.delegatedStatus),
      ].join(","),
    );
  }

  const csv = lines.join("\r\n");
  const filename = `clients-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
