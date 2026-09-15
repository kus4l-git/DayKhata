import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { clients, credentials } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { unauthorized } from "@/lib/http";
import { decryptSecret } from "@/lib/crypto";

function escapeCsv(v: string | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  /* require PIN header for credentials export — extra security layer */
  const pin = request.headers.get("x-export-confirm");
  if (pin !== "CONFIRMED") {
    return new Response(
      JSON.stringify({ error: "Send header X-Export-Confirm: CONFIRMED to export credentials" }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  const rows = await db
    .select({
      id:               credentials.id,
      title:            credentials.title,
      username:         credentials.username,
      email:            credentials.email,
      secretCiphertext: credentials.secretCiphertext,
      notes:            credentials.notes,
      clientId:         credentials.clientId,
      clientName:       clients.name,
      createdAt:        credentials.createdAt,
    })
    .from(credentials)
    .leftJoin(clients, eq(credentials.clientId, clients.id))
    .orderBy(asc(credentials.createdAt));

  const HEADERS = [
    "client_name",
    "title",
    "username",
    "email",
    "secret",
    "notes",
  ];

  const lines: string[] = [HEADERS.join(",")];

  for (const r of rows) {
    let secret = "";
    try {
      secret = decryptSecret(r.secretCiphertext);
    } catch {
      secret = "[DECRYPT_ERROR]";
    }

    lines.push(
      [
        escapeCsv(r.clientName),
        escapeCsv(r.title),
        escapeCsv(r.username),
        escapeCsv(r.email),
        escapeCsv(secret),
        escapeCsv(r.notes),
      ].join(","),
    );
  }

  const csv = lines.join("\r\n");
  const filename = `credentials-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
