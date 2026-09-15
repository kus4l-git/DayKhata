import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { badRequest, unauthorized } from "@/lib/http";
import { db } from "@/db";
import { files } from "@/db/schema";
import { eq } from "drizzle-orm";

const baseDir = path.join(process.cwd(), ".uploads");

export async function GET(request: Request) {
  const user = await requireUser().catch(() => null);
  if (!user) return unauthorized();

  const { searchParams } = new URL(request.url);
  const objectPath = searchParams.get("path");
  if (!objectPath) return badRequest("Missing path");

  try {
    // Check if file exists in database and get its storage provider
    const fileRecord = await db
      .select({ storageProvider: files.storageProvider, storagePath: files.storagePath })
      .from(files)
      .where(eq(files.storagePath, objectPath))
      .limit(1);

    if (fileRecord.length === 0) {
      return new Response(JSON.stringify({ error: "File not found in database" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const fileInfo = fileRecord[0];

    // If file is stored in Supabase, proxy the download
    if (fileInfo.storageProvider === "supabase") {
      const supabaseUrl = process.env.SUPABASE_URL;
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const bucket = process.env.SUPABASE_STORAGE_BUCKET || "client-files";

      if (!supabaseUrl || !serviceKey) {
        return new Response(JSON.stringify({ error: "Supabase not configured" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Download from Supabase storage
      const downloadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
      const response = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Supabase download failed:", response.status, errorText);
        return new Response(JSON.stringify({ error: "Failed to download from Supabase" }), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }

      const buffer = await response.arrayBuffer();
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": response.headers.get("Content-Type") || "application/octet-stream",
          "Content-Disposition": `attachment; filename="${path.basename(objectPath)}"`,
        },
      });
    }

    // Local file storage
    const fullPath = path.join(baseDir, objectPath);
    const content = await readFile(fullPath);

    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(fullPath)}"`,
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Download failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
