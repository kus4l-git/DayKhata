import path from "node:path";
import { randomUUID } from "node:crypto";

export type UploadAuthItem = {
  localId: string;
  objectPath: string;
  uploadUrl: string;
  headers: Record<string, string>;
  provider: "supabase" | "local";
};

function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function extOf(name: string) {
  const ext = path.extname(name).replace(".", "").toLowerCase();
  return ext || "bin";
}

export async function createUploadAuthorizations(
  files: Array<{ localId: string; fileName: string; contentType: string; clientId: string }>,
) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || "client-files";

  const folderDate = new Date().toISOString().slice(0, 10);

  if (supabaseUrl && serviceKey) {
    const items: UploadAuthItem[] = [];

    for (const f of files) {
      const objectPath = `${f.clientId}/${folderDate}/${randomUUID()}-${slugifyName(f.fileName)}`;
      const response = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${objectPath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ upsert: false }),
      });

      if (!response.ok) {
        const bodyText = await response.text();
        throw new Error(`Storage authorization failed: ${bodyText.slice(0, 180)}`);
      }

      const data = (await response.json()) as { token?: string };
      if (!data.token) {
        throw new Error("Missing signed upload token");
      }

      const uploadUrl = `${supabaseUrl}/storage/v1/object/upload/sign/${bucket}/${objectPath}?token=${encodeURIComponent(data.token)}`;
      items.push({
        localId: f.localId,
        objectPath,
        uploadUrl,
        headers: {
          "Content-Type": f.contentType || "application/octet-stream",
          "x-upsert": "false",
        },
        provider: "supabase",
      });
    }

    return items;
  }

  return files.map((f) => {
    const objectPath = `${f.clientId}/${folderDate}/${randomUUID()}-${slugifyName(f.fileName)}`;
    return {
      localId: f.localId,
      objectPath,
      uploadUrl: `/api/files/local-upload?path=${encodeURIComponent(objectPath)}`,
      headers: {
        "Content-Type": f.contentType || "application/octet-stream",
      },
      provider: "local" as const,
    };
  });
}

export function buildDownloadUrl(storagePath: string): string {
  // Always use the local-download endpoint which now handles both Supabase and local files
  return `/api/files/local-download?path=${encodeURIComponent(storagePath)}`;
}

export function fileExtension(fileName: string) {
  return extOf(fileName);
}
