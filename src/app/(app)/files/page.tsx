"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BulkBar, BulkButton, Button, Checkbox, EmptyState,
  FileTypeIcon, formatBytes, Pagination, SkeletonCard,
  TimeAgo, ViewSwitcher,
} from "@/components/ui";
import { ConfirmModal, useToast } from "@/components/modals";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiGet, apiSend } from "@/lib/api-client";

/* ============================================================
   TYPES
   ============================================================ */
type FileRow = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extension: string | null;
  storagePath: string;
  status: "READY" | "UPLOADING" | "FAILED" | "DELETED";
  createdAt: string;
};

type FilesPayload = { items: FileRow[]; total: number; offset: number };
type ClientOption = { id: string; name: string; tpin: string };

type QueueItem = {
  localId: string;
  file: File;
  /** null = no client matched — upload immediately, server stores as unmatched */
  assignedClientId: string | null;
  status: "queued" | "uploading" | "success" | "failed" | "cancelled";
  progress: number;
  objectPath?: string;
  provider?: "supabase" | "local";
  error?: string;
  xhr?: XMLHttpRequest;
};

const MAX_CONCURRENCY = 6;

/* ── Same scoring algorithm used on the server (/api/files/rematch) ── */
function autoMatchClient(fileName: string, clientList: ClientOption[]): string | null {
  if (!clientList.length) return null;
  const lower = fileName.toLowerCase().replace(/[-_.()\[\]]/g, " ");
  let best: { id: string; score: number } | null = null;
  for (const c of clientList) {
    const parts = c.name.toLowerCase().split(/\s+/).filter(Boolean);
    if (parts.every((p) => lower.includes(p))) {
      const score = parts.reduce((s, p) => s + p.length, 0);
      if (!best || score > best.score) best = { id: c.id, score };
    }
  }
  return best ? best.id : null;
}

/* ============================================================
   VIEW OPTIONS
   ============================================================ */
const VIEW_OPTS = [
  {
    value: "compact",
    label: "Compact",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    value: "grid",
    label: "Grid",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    value: "masonry",
    label: "Masonry",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="10" rx="1" /><rect x="14" y="3" width="7" height="6" rx="1" />
        <rect x="14" y="13" width="7" height="8" rx="1" /><rect x="3" y="17" width="7" height="4" rx="1" />
      </svg>
    ),
  },
];

/* ============================================================
   PAGE
   ============================================================ */
export default function FilesPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [search, setSearch]     = useState("");
  const [clientId, setClientId] = useState("all");
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | "all">(20);
  const [view, setView]         = useState<"compact" | "grid" | "masonry">("compact");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [queue, setQueue]       = useState<QueueItem[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [transferOpen, setTransferOpen]   = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");

  const debouncedSearch = useDebouncedValue(search, 250);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const parentRef       = useRef<HTMLDivElement | null>(null);
  const queueRef        = useRef(queue);
  queueRef.current      = queue;

  /* ── queries ── */
  const queryKey = useMemo(
    () => ["files", debouncedSearch, clientId, page, pageSize],
    [debouncedSearch, clientId, page, pageSize],
  );

  const filesQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<FilesPayload>(
        `/api/files?search=${encodeURIComponent(debouncedSearch)}&clientId=${clientId}&page=${page}&pageSize=${pageSize}`,
      ),
    placeholderData: (prev) => prev,
  });

  const clientsQuery = useQuery({
    queryKey: ["client-options"],
    queryFn: () => apiGet<{ items: ClientOption[] }>("/api/clients/options"),
  });

  const rows    = filesQuery.data?.items ?? [];
  const clients = clientsQuery.data?.items ?? [];

  /* ── auto-rematch whenever the clients list changes ── */
  const prevClientCountRef = useRef<number | null>(null);
  useEffect(() => {
    const count = clients.length;
    if (prevClientCountRef.current !== null && prevClientCountRef.current !== count) {
      /* client list changed — silently try to rematch unassigned files */
      apiSend<{ matched: number; skipped: number }>("/api/files/rematch", "POST")
        .then(({ matched }) => {
          if (matched > 0) {
            queryClient.invalidateQueries({ queryKey: ["files"] });
            toast(`${matched} file${matched !== 1 ? "s" : ""} matched to a client`, "success");
          }
        })
        .catch(() => { /* silent */ });
    }
    prevClientCountRef.current = count;
  }, [clients.length, queryClient, toast]);

  /* ── bulk delete ── */
  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) => apiSend<{ deletedIds: string[] }>("/api/files", "DELETE", { ids }),
    onSuccess: () => {
      setSelected(new Set()); setDeleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast("Files deleted", "success");
    },
    onError: (e: Error) => toast(e.message || "Delete failed", "error"),
  });

  /* ── transfer ── */
  const transferMutation = useMutation({
    mutationFn: ({ ids, targetClientId }: { ids: string[]; targetClientId: string }) =>
      apiSend<{ items: unknown[] }>("/api/files/transfer", "POST", { fileIds: ids, targetClientId }),
    onSuccess: () => {
      setSelected(new Set()); setTransferOpen(false); setTransferTargetId("");
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast("Files transferred", "success");
    },
    onError: (e: Error) => toast(e.message || "Transfer failed", "error"),
  });

  /* ── manual rematch button ── */
  const rematchMutation = useMutation({
    mutationFn: () => apiSend<{ matched: number; skipped: number }>("/api/files/rematch", "POST"),
    onSuccess: ({ matched }) => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      toast(
        matched > 0
          ? `${matched} file${matched !== 1 ? "s" : ""} matched to a client`
          : "No new matches found",
        matched > 0 ? "success" : "info",
      );
    },
    onError: (e: Error) => toast(e.message || "Rematch failed", "error"),
  });

  /* ============================================================
     UPLOAD LOGIC
     ============================================================ */
  function patchQueue(localId: string, patch: Partial<QueueItem>) {
    setQueue((curr) => curr.map((q) => (q.localId === localId ? { ...q, ...patch } : q)));
  }

  async function uploadOne(
    item: QueueItem,
    auth: { uploadUrl: string; headers: Record<string, string>; objectPath: string; provider: "supabase" | "local" },
  ) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", auth.uploadUrl, true);
      Object.entries(auth.headers).forEach(([k, v]) => xhr.setRequestHeader(k, v));
      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        patchQueue(item.localId, { progress: Math.min(99, Math.round((ev.loaded / ev.total) * 100)) });
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          patchQueue(item.localId, { progress: 100, status: "success", objectPath: auth.objectPath, provider: auth.provider });
          resolve();
        } else {
          patchQueue(item.localId, { status: "failed", error: `HTTP ${xhr.status}` });
          reject(new Error("Upload failed"));
        }
      };
      xhr.onerror = () => { patchQueue(item.localId, { status: "failed", error: "Network error" }); reject(new Error("Network error")); };
      xhr.onabort = () => { patchQueue(item.localId, { status: "cancelled" }); reject(new Error("Cancelled")); };
      patchQueue(item.localId, { status: "uploading", xhr, objectPath: auth.objectPath, provider: auth.provider });
      xhr.send(item.file);
    });
  }

  /**
   * Upload queued items, grouped by clientId (including null = unmatched).
   * ALL files start immediately — matched go under their client,
   * unmatched are stored server-side with clientId = null.
   */
  const startUpload = useCallback(async (targetItems?: QueueItem[]) => {
    const items = (targetItems ?? queueRef.current).filter(
      (q) => q.status === "queued" || q.status === "failed",
    );
    if (!items.length) return;

    /* Group by assignedClientId — use "null" string as Map key for unmatched */
    const byClient = new Map<string, QueueItem[]>();
    for (const item of items) {
      const key = item.assignedClientId ?? "null";
      if (!byClient.has(key)) byClient.set(key, []);
      byClient.get(key)!.push(item);
    }

    for (const [cidKey, clientItems] of byClient) {
      const realClientId = cidKey === "null" ? null : cidKey;
      try {
        const auth = await apiSend<{
          items: Array<{ localId: string; uploadUrl: string; headers: Record<string, string>; objectPath: string; provider: "supabase" | "local" }>;
        }>("/api/files/upload-auth", "POST", {
          clientId: realClientId,   /* null is sent as null — API handles it */
          files: clientItems.map((i) => ({
            localId:     i.localId,
            fileName:    i.file.name,
            contentType: i.file.type || "application/octet-stream",
            sizeBytes:   i.file.size,
          })),
        });

        const authMap = new Map(auth.items.map((a) => [a.localId, a]));
        let pointer = 0;
        await Promise.all(
          Array.from({ length: Math.min(MAX_CONCURRENCY, clientItems.length) }).map(async () => {
            while (pointer < clientItems.length) {
              const cur    = clientItems[pointer++];
              const signed = authMap.get(cur.localId);
              if (!signed) continue;
              try { await uploadOne(cur, signed); } catch { /* per-item state updated */ }
            }
          }),
        );
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload auth failed";
        clientItems.forEach((ci) => patchQueue(ci.localId, { status: "failed", error: msg }));
      }
    }

    /* Commit all finished items, grouped by client */
    const latest = queueRef.current;
    const done   = latest.filter((q) => q.status === "success" || q.status === "failed");
    if (!done.length) return;

    const commitByClient = new Map<string, QueueItem[]>();
    for (const d of done) {
      const key = d.assignedClientId ?? "null";
      if (!commitByClient.has(key)) commitByClient.set(key, []);
      commitByClient.get(key)!.push(d);
    }

    for (const [cidKey, commitItems] of commitByClient) {
      const realClientId = cidKey === "null" ? null : cidKey;
      try {
        await apiSend("/api/files/commit-batch", "POST", {
          clientId: realClientId,
          items: commitItems.map((d) => ({
            fileName:    d.file.name,
            objectPath:  d.objectPath!,
            contentType: d.file.type || "application/octet-stream",
            sizeBytes:   d.file.size,
            status:      d.status === "success" ? "READY" : "FAILED",
            provider:    d.provider || "local",
          })),
        });
      } catch { /* non-fatal */ }
    }

    queryClient.invalidateQueries({ queryKey: ["files"] });
    const okCount = done.filter((d) => d.status === "success").length;
    if (okCount > 0) toast(`${okCount} file${okCount !== 1 ? "s" : ""} uploaded`, "success");
  }, [queryClient, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * All files start uploading immediately.
   * Matched → upload under client. Unmatched → upload with null clientId.
   * No picker shown, no waiting.
   */
  function addFiles(fl: FileList | null) {
    if (!fl) return;
    const newItems: QueueItem[] = Array.from(fl).map((file, i) => ({
      localId:          `${Date.now()}-${i}-${Math.random().toString(16).slice(2)}`,
      file,
      assignedClientId: autoMatchClient(file.name, clients),   /* null = unmatched */
      status:           "queued",
      progress:         0,
    }));
    setQueue((c) => [...c, ...newItems]);
    setShowQueue(true);
    /* All items start immediately */
    setTimeout(() => startUpload(newItems), 0);
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  useEffect(() => {
    if (!filesQuery.data || pageSize === "all") return;
    const max = Math.max(1, Math.ceil(filesQuery.data.total / (pageSize as number)));
    if (page > max) setPage(max);
  }, [filesQuery.data, page, pageSize]);

  const activeUploads = queue.filter((q) => q.status === "uploading").length;
  const doneUploads   = queue.filter((q) => q.status === "success").length;
  const failedUploads = queue.filter((q) => q.status === "failed").length;
  const totalInQueue  = queue.length;

  useEffect(() => {
    if (totalInQueue > 0 && activeUploads === 0 && failedUploads === 0 && doneUploads === totalInQueue) {
      const t = setTimeout(() => { setQueue([]); setShowQueue(false); }, 2000);
      return () => clearTimeout(t);
    }
  }, [totalInQueue, activeUploads, failedUploads, doneUploads]);

  /* count unmatched files in the current data */
  const unmatchedCount = rows.filter((r) => !r.clientId).length;

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Library</span>
          <h1 className="page-title">Files</h1>
          <p className="page-subtitle">
            Drop files anywhere — auto-sorted by client name. Unmatched files are stored and re-sorted when a matching client is added.
          </p>
        </div>
        <div className="page-actions">
          {/* Manual rematch button — only shown when unmatched files exist */}
          {unmatchedCount > 0 && (
            <Button
              variant="ghost" size="md"
              loading={rematchMutation.isPending}
              onClick={() => rematchMutation.mutate()}
              icon={
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              }
            >
              Rematch {unmatchedCount} unmatched
            </Button>
          )}
          <Button
            variant="primary" size="md"
            onClick={() => fileInputRef.current?.click()}
            icon={
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
              </svg>
            }
          >
            Upload Files
          </Button>
          <input
            ref={fileInputRef} type="file" multiple
            style={{ display: "none" }}
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="filter-bar">
        <div className="search-input-wrap">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text" value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search files…"
            className="filter-input"
            style={{ paddingLeft: 34, width: 220 }}
          />
        </div>
        <select
          value={clientId}
          onChange={(e) => { setClientId(e.target.value); setPage(1); }}
          className="filter-select" style={{ width: 165 }}
        >
          <option value="all">All clients</option>
          <option value="unmatched">Unmatched</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {filesQuery.data && (
            <span style={{ fontSize: "0.775rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
              {filesQuery.data.total} file{filesQuery.data.total !== 1 ? "s" : ""}
            </span>
          )}
          <ViewSwitcher view={view} onChange={(v) => setView(v as typeof view)} options={VIEW_OPTS} />
        </div>
      </div>

      {/* ── Drop zone (invisible — drag-drop still works, no text shown) ── */}
      {queue.length === 0 && (
        <div
          className={`upload-zone${dragOver ? " drag-over" : ""}`}
          style={{ marginBottom: 20, minHeight: 0, padding: dragOver ? "28px 20px" : "0", border: dragOver ? undefined : "none", background: dragOver ? undefined : "transparent" }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          {dragOver && (
            <div style={{ textAlign: "center", pointerEvents: "none" }}>
              <div className="upload-icon-chip" style={{ margin: "0 auto 8px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
                  <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
                </svg>
              </div>
              <p style={{ fontSize: "0.925rem", fontWeight: 550, color: "var(--fg-muted)" }}>Drop to upload</p>
            </div>
          )}
        </div>
      )}

      {/* ── Bulk bar ── */}
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkButton onClick={() => setDeleteConfirm(true)}
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>}
        >Delete</BulkButton>
        <BulkButton onClick={() => setTransferOpen(true)}
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>}
        >Transfer to Client</BulkButton>
        <BulkButton onClick={async () => {
          const res = await apiSend<{ items: Array<{ url: string }> }>("/api/files/bulk-download", "POST", { ids: Array.from(selected) });
          res.items.forEach((item) => window.open(item.url, "_blank"));
        }}
          icon={<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" /></svg>}
        >Download</BulkButton>
        {rows.length > 0 && selected.size < rows.length && (
          <BulkButton onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>
            Select all {rows.length}
          </BulkButton>
        )}
      </BulkBar>

      {/* ── Loading ── */}
      {filesQuery.isLoading && !filesQuery.data && view !== "compact" && (
        <div className="masonry-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="masonry-item"><SkeletonCard height={160 + (i % 3) * 60} /></div>
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!filesQuery.isLoading && rows.length === 0 && (
        <EmptyState
          title="No files yet"
          description="Drop files anywhere — they're stored immediately and matched to a client automatically."
          action={<Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>Upload Files</Button>}
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>}
        />
      )}

      {/* ── Compact view ── */}
      {rows.length > 0 && view === "compact" && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th style={{ width: 32, paddingLeft: 20 }}>
                    <Checkbox
                      checked={selected.size === rows.length && rows.length > 0}
                      indeterminate={selected.size > 0 && selected.size < rows.length}
                      onChange={(c) => c ? setSelected(new Set(rows.map((r) => r.id))) : setSelected(new Set())}
                    />
                  </th>
                  <th style={{ width: 40 }}>#</th>
                  <th>Name</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th style={{ paddingRight: 20 }}>Added</th>
                  <th style={{ width: 44, paddingRight: 16 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item, index) => (
                  <tr key={item.id} className={selected.has(item.id) ? "selected" : ""}>
                    <td style={{ paddingLeft: 20 }}><Checkbox checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                    <td style={{ color: "var(--fg-subtle)" }}>{(filesQuery.data?.offset ?? 0) + index + 1}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <FileTypeIcon mimeType={item.mimeType} extension={item.extension} size={26} />
                        <span className="td-primary" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>{item.originalName}</span>
                      </div>
                    </td>
                    <td><ClientLabel clientName={item.clientName} /></td>
                    <td><span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.73rem", color: "var(--fg-muted)" }}>{item.mimeType.split("/")[1]?.slice(0, 12) ?? item.mimeType}</span></td>
                    <td>{formatBytes(item.sizeBytes)}</td>
                    <td style={{ paddingRight: 20 }}><TimeAgo date={item.createdAt} /></td>
                    <td style={{ paddingRight: 16 }}>
                      <div style={{ display: "flex", gap: 2 }}>
                        {/* Download */}
                        <button
                          title="Download"
                          onClick={async () => {
                            try {
                              const res = await apiSend<{ items: Array<{ url: string }> }>("/api/files/bulk-download", "POST", { ids: [item.id] });
                              if (res.items[0]) window.open(res.items[0].url, "_blank");
                            } catch { /* ignore */ }
                          }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--radius-md)", border: "none", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.background = "var(--bg-subtle)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                        </button>
                        {/* Delete */}
                        <button onClick={() => { setSelected(new Set([item.id])); setDeleteConfirm(true); }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--radius-md)", border: "none", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)" }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#b91c1c"; e.currentTarget.style.background = "#fef2f2"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filesQuery.data && filesQuery.data.total > 0 && (
            <div style={{ padding: "4px 0 14px" }}>
              <Pagination page={page} total={filesQuery.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
            </div>
          )}
        </>
      )}

      {/* ── Grid view ── */}
      {rows.length > 0 && view === "grid" && (
        <div className="pin-grid">
          {rows.map((item) => (
            <FilePinCard key={item.id} item={item} selected={selected.has(item.id)} onToggle={() => toggleSelect(item.id)} onDelete={() => { setSelected(new Set([item.id])); setDeleteConfirm(true); }} />
          ))}
        </div>
      )}

      {/* ── Masonry view ── */}
      {rows.length > 0 && view === "masonry" && (
        <div className="masonry-grid">
          {rows.map((item) => (
            <div key={item.id} className="masonry-item">
              <FilePinCard item={item} selected={selected.has(item.id)} onToggle={() => toggleSelect(item.id)} onDelete={() => { setSelected(new Set([item.id])); setDeleteConfirm(true); }} />
            </div>
          ))}
        </div>
      )}

      {/* Pagination for grid/masonry */}
      {rows.length > 0 && view !== "compact" && filesQuery.data && filesQuery.data.total > 0 && (
        <div style={{ marginTop: 16 }}>
          <Pagination page={page} total={filesQuery.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      {/* ── Floating upload queue ── */}
      {queue.length > 0 && showQueue && (
        <div className="upload-queue-float">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: "0.825rem", fontWeight: 650, color: "#fff" }}>
                {activeUploads > 0 ? "Uploading…" : failedUploads > 0 ? "Some files failed" : "All done"}
              </p>
              <p style={{ fontSize: "0.725rem", color: "rgba(255,255,255,0.5)", marginTop: 1 }}>
                {doneUploads} done{activeUploads > 0 ? ` · ${activeUploads} uploading` : ""}{failedUploads > 0 ? ` · ${failedUploads} failed` : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => fileInputRef.current?.click()}
                style={{ height: 26, padding: "0 10px", borderRadius: "var(--radius-pill)", border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)", fontSize: "0.72rem", cursor: "pointer" }}>
                + Add more
              </button>
              <button onClick={() => { queue.forEach((q) => q.xhr?.abort()); setQueue([]); setShowQueue(false); }}
                style={{ height: 26, width: 26, borderRadius: "var(--radius-sm)", border: "none", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>
          </div>

          <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {queue.map((q) => {
              const matched = q.assignedClientId
                ? clients.find((c) => c.id === q.assignedClientId)?.name ?? "Client"
                : null;
              return (
                <div key={q.localId} style={{ background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-md)", padding: "7px 10px", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ flex: 1, fontSize: "0.775rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.file.name}</span>
                    <span style={{ fontSize: "0.7rem", color: q.status === "success" ? "#4ade80" : q.status === "failed" ? "#f87171" : "rgba(255,255,255,0.5)", flexShrink: 0 }}>
                      {q.status === "uploading" ? `${q.progress}%` : q.status === "success" ? "✓" : q.status === "failed" ? "✗" : q.status === "cancelled" ? "—" : "queued"}
                    </span>
                    {q.status === "uploading" && (
                      <button onClick={() => q.xhr?.abort()} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                    )}
                    {q.status === "failed" && (
                      <button onClick={() => { patchQueue(q.localId, { status: "queued", error: undefined, progress: 0 }); startUpload([{ ...q, status: "queued" }]); }}
                        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline", padding: 0 }}>Retry</button>
                    )}
                  </div>
                  {/* Client assignment label */}
                  <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 5 }}>
                    {matched ? (
                      <>
                        <span style={{ fontSize: "0.68rem", color: "#4ade80" }}>→</span>
                        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)" }}>{matched}</span>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: "0.68rem", color: "#f59e0b" }}>⟳</span>
                        <span style={{ fontSize: "0.7rem", color: "rgba(251,191,36,0.7)" }}>
                          Unmatched — will sort when client is added
                        </span>
                      </>
                    )}
                  </div>
                  {(q.status === "uploading" || (q.status === "queued")) && (
                    <div style={{ marginTop: 5, height: 2, borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${q.progress}%`, background: "#fff", borderRadius: "var(--radius-pill)", transition: "width 180ms" }} />
                    </div>
                  )}
                  {q.error && <p style={{ marginTop: 3, fontSize: "0.68rem", color: "#f87171" }}>{q.error}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      <ConfirmModal
        open={deleteConfirm} onClose={() => setDeleteConfirm(false)}
        onConfirm={() => bulkDelete.mutate(Array.from(selected))}
        title={`Delete ${selected.size} file${selected.size !== 1 ? "s" : ""}`}
        description="Files will be permanently removed from storage. This cannot be undone."
        confirmLabel="Delete" danger loading={bulkDelete.isPending}
      />

      {/* ── Transfer modal ── */}
      {transferOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setTransferOpen(false)} />
          <div className="modal-panel" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Transfer {selected.size} file{selected.size !== 1 ? "s" : ""}</h2>
                <p className="modal-subtitle">Move selected files to a different client.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setTransferOpen(false)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <label className="field-label">Destination client<span className="field-required">*</span></label>
              <select value={transferTargetId} onChange={(e) => setTransferTargetId(e.target.value)} className="field-select" style={{ width: "100%" }}>
                <option value="">Select a client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" size="sm" onClick={() => setTransferOpen(false)} disabled={transferMutation.isPending}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!transferTargetId} loading={transferMutation.isPending}
                onClick={() => transferMutation.mutate({ ids: Array.from(selected), targetClientId: transferTargetId })}>
                Transfer Files
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Client label — shows "Unmatched" badge for null clientId ── */
function ClientLabel({ clientName }: { clientName: string | null }) {
  if (clientName) {
    return <span style={{ fontSize: "0.8rem", color: "var(--fg-muted)" }}>{clientName}</span>;
  }
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 7px", borderRadius: "var(--radius-pill)",
      background: "var(--status-wip-bg)",
      border: "1px solid rgba(180,83,9,0.15)",
      fontSize: "0.7rem", fontWeight: 550, color: "var(--status-wip-fg)",
      whiteSpace: "nowrap",
    }}>
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
      </svg>
      Unmatched
    </span>
  );
}

/* ── File pin card ── */
function FilePinCard({ item, selected, onToggle, onDelete }: {
  item: FileRow; selected: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isImage  = item.mimeType.startsWith("image/");
  const heights  = [140, 180, 200, 160, 220, 170, 190, 150];
  const thumbH   = heights[item.id.charCodeAt(0) % heights.length];

  return (
    <div className="pin-card" style={{ border: selected ? "2px solid var(--accent)" : "1px solid var(--border)" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onClick={onToggle}>
      <div className="pin-thumb" style={{ height: thumbH }}>
        {isImage ? (
          <img src={`/api/files/local-download?path=${encodeURIComponent(item.storagePath)}`} alt={item.originalName}
            loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="pin-thumb-placeholder">
            <FileTypeBg mimeType={item.mimeType}>
              <div className="pin-thumb-icon-chip"><FileTypeIcon mimeType={item.mimeType} extension={item.extension} size={28} /></div>
            </FileTypeBg>
          </div>
        )}
        <span className="pin-badge">
          {item.extension ? item.extension.toUpperCase() : item.mimeType.split("/")[1]?.slice(0, 4).toUpperCase() ?? "FILE"}
        </span>
        <div className="pin-actions" onClick={(e) => e.stopPropagation()}>
          <button className="pin-action-btn" title="Download" onClick={async () => {
            try {
              const res = await apiSend<{ items: Array<{ url: string }> }>("/api/files/bulk-download", "POST", { ids: [item.id] });
              if (res.items[0]) window.open(res.items[0].url, "_blank");
            } catch { /* ignore */ }
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="8 17 12 21 16 17" /><line x1="12" y1="12" x2="12" y2="21" /></svg>
          </button>
          <button className="pin-action-btn" title="Delete" style={{ color: "#b91c1c" }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
        <div className="pin-overlay" onClick={(e) => e.stopPropagation()}>
          <p className="pin-overlay-title">{item.originalName}</p>
        </div>
        {selected && (
          <div style={{ position: "absolute", top: 8, left: 8, width: 20, height: 20, borderRadius: "var(--radius-xs)", background: "var(--accent)", border: "2.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>
          </div>
        )}
      </div>
      <div className="pin-body">
        <p className="pin-title">{item.originalName}</p>
        <div className="pin-meta">
          {item.clientName
            ? <span className="pin-meta-text">{item.clientName}</span>
            : <span style={{ fontSize: "0.7rem", color: "var(--status-wip-fg)", fontWeight: 550 }}>Unmatched</span>
          }
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <span className="pin-meta-text">{formatBytes(item.sizeBytes)}</span>
          <span style={{ color: "var(--border-strong)" }}>·</span>
          <TimeAgo date={item.createdAt} />
        </div>
      </div>
    </div>
  );
}

function FileTypeBg({ mimeType, children }: { mimeType: string; children: React.ReactNode }) {
  const mime = mimeType.toLowerCase();
  let bg = "linear-gradient(135deg,#f5f5f4,#e7e5e4)";
  if (mime.startsWith("image/"))       bg = "linear-gradient(135deg,#dcf5e4,#bbf7d0)";
  else if (mime.includes("pdf"))       bg = "linear-gradient(135deg,#fecaca,#fca5a5)";
  else if (mime.includes("word"))      bg = "linear-gradient(135deg,#dbeafe,#bfdbfe)";
  else if (mime.includes("sheet"))     bg = "linear-gradient(135deg,#d1fae5,#a7f3d0)";
  else if (mime.includes("zip"))       bg = "linear-gradient(135deg,#ede9fe,#ddd6fe)";
  else if (mime.startsWith("video/"))  bg = "linear-gradient(135deg,#fce7f3,#fbcfe8)";
  return (
    <div style={{ width: "100%", height: "100%", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}
