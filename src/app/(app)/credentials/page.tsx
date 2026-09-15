"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import {
  Button, EmptyState, IpLink, Pagination,
  SkeletonCard, SkeletonRows, TimeAgo, ViewSwitcher,
} from "@/components/ui";
import {
  ConfirmModal, Drawer, FieldInput, FieldSelect,
  FormGrid, FormRow, PinModal, useToast,
} from "@/components/modals";
import { ImportResultPanel } from "@/app/(app)/clients/page";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiGet, apiSend } from "@/lib/api-client";

/* ============================================================
   TYPES
   ============================================================ */
type Row = {
  id: string;
  clientId: string;
  clientName: string | null;
  clientIp:   string | null;
  title: string;
  username: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
};

type CredForm = {
  clientId: string; title: string; username: string;
  email: string; secret: string; notes: string;
};

type ImportResult = { inserted: number; errors: Array<{ row: number; message: string }> };

const EMPTY: CredForm = { clientId: "", title: "", username: "", email: "", secret: "", notes: "" };

function rowToForm(item: Row): CredForm {
  return {
    clientId: item.clientId,
    title:    item.title,
    username: item.username ?? "",
    email:    item.email    ?? "",
    secret:   "",
    notes:    item.notes    ?? "",
  };
}

const CRED_TEMPLATE_CSV =
  "client_name,title,username,email,secret,notes\n" +
  "Acme Corporation,cPanel Login,admin,admin@acme.com,MySecretPass123,Main hosting panel\n" +
  "Acme Corporation,SSH Key,root,,ssh-rsa AAAA...,Production server\n" +
  "Global Tech,WordPress Admin,wpuser,wp@globaltech.com,WpPass456,";

/* ============================================================
   VIEW OPTIONS
   ============================================================ */
const VIEW_OPTS = [
  {
    value: "table",
    label: "Table",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
  {
    value: "cards",
    label: "Cards",
    icon: (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
];

/* ============================================================
   SERVICE GRADIENTS (cards view)
   ============================================================ */
const SERVICE_GRADIENTS: Record<string, string> = {
  cpanel:    "linear-gradient(135deg,#ff6b35,#f7931e)",
  ssh:       "linear-gradient(135deg,#1c1917,#3f3f46)",
  ftp:       "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  mysql:     "linear-gradient(135deg,#005f87,#00758f)",
  wordpress: "linear-gradient(135deg,#21759b,#006088)",
  aws:       "linear-gradient(135deg,#ff9900,#ffba54)",
  github:    "linear-gradient(135deg,#24292e,#586069)",
  google:    "linear-gradient(135deg,#4285f4,#34a853)",
  email:     "linear-gradient(135deg,#6d28d9,#8b5cf6)",
};
function serviceGradient(title: string): string {
  const key = title.toLowerCase().replace(/\s/g, "");
  for (const [k, v] of Object.entries(SERVICE_GRADIENTS)) if (key.includes(k)) return v;
  const FB = ["linear-gradient(135deg,#1c1917,#2d2d30)","linear-gradient(135deg,#0f172a,#1e293b)","linear-gradient(135deg,#1a1a2e,#16213e)","linear-gradient(135deg,#240046,#3c096c)","linear-gradient(135deg,#1b1b2f,#2e294e)"];
  let h = 0; for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return FB[h % FB.length];
}

/* ============================================================
   ICONS
   ============================================================ */
const Icons = {
  plus:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  pencil:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  trash:    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  upload:   <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  template: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  eye:      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
  eyeOff:   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  shield:   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  copy:     <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>,
};

function downloadBlob(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   PAGE
   ============================================================ */
export default function CredentialsPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState<20 | 50 | 100 | "all">(20);
  const [clientId, setClientId] = useState("all");
  /* view: table (default) or cards */
  const [view, setView]         = useState<"table" | "cards">("table");

  /* revealed secrets: id → plaintext */
  const [revealed, setRevealed] = useState<Record<string, string>>({});

  /* drawer */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget] = useState<Row | null>(null);
  const [form, setForm]             = useState<CredForm>(EMPTY);
  const [formErrors, setFormErrors] = useState<Partial<CredForm>>({});
  const [showSecret, setShowSecret] = useState(false);

  /* pin */
  const [pinTarget, setPinTarget]   = useState<string | null>(null);
  const [pinError, setPinError]     = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  /* delete */
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

  /* import */
  const [importOpen, setImportOpen]         = useState(false);
  const [importFile, setImportFile]         = useState<File | null>(null);
  const [importLoading, setImportLoading]   = useState(false);
  const [importResult, setImportResult]     = useState<ImportResult | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  /* export */
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exporting, setExporting]                 = useState(false);

  const debounced = useDebouncedValue(search, 250);
  const queryKey  = useMemo(
    () => ["credentials", debounced, page, pageSize, clientId],
    [debounced, page, pageSize, clientId],
  );

  const list = useQuery({
    queryKey,
    queryFn: () =>
      apiGet<{ items: Row[]; total: number; offset: number }>(
        `/api/credentials?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${pageSize}&clientId=${clientId}`,
      ),
    placeholderData: (prev) => prev,
  });

  const clients = useQuery({
    queryKey: ["client-options"],
    queryFn:  () => apiGet<{ items: Array<{ id: string; name: string }> }>("/api/clients/options"),
  });

  /* ── create ── */
  const create = useMutation({
    mutationFn: (b: CredForm) =>
      apiSend("/api/credentials", "POST", {
        clientId: b.clientId, title: b.title.trim(), secret: b.secret,
        username: b.username.trim() || undefined,
        email:    b.email.trim()    || undefined,
        notes:    b.notes.trim()    || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setDrawerOpen(false); setForm(EMPTY);
      toast("Credential saved", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to save", "error"),
  });

  /* ── update ── */
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CredForm }) =>
      apiSend(`/api/credentials/${id}`, "PUT", {
        title:    body.title.trim(),
        clientId: body.clientId || undefined,
        username: body.username.trim() || null,
        email:    body.email.trim()    || null,
        notes:    body.notes.trim()    || null,
        ...(body.secret ? { secret: body.secret } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setDrawerOpen(false); setEditTarget(null);
      toast("Credential updated", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to update", "error"),
  });

  /* ── delete ── */
  const remove = useMutation({
    mutationFn: (id: string) => apiSend(`/api/credentials/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credentials"] });
      setDeleteTarget(null);
      toast("Credential deleted", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to delete", "error"),
  });

  /* ── reveal via PIN ── */
  async function handleReveal(id: string, pin: string) {
    setPinLoading(true); setPinError(null);
    try {
      const data = await apiSend<{ secret: string }>("/api/credentials/reveal", "POST", {
        credentialId: id, pin,
      });
      setRevealed((r) => ({ ...r, [id]: data.secret }));
      setPinTarget(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Incorrect PIN";
      setPinError(msg.toLowerCase().includes("pin") || msg.includes("401") ? "Incorrect PIN" : msg);
    } finally { setPinLoading(false); }
  }

  function openCreate() {
    setDrawerMode("create"); setForm(EMPTY); setFormErrors({});
    setEditTarget(null); setShowSecret(false); setDrawerOpen(true);
  }
  function openEdit(item: Row) {
    setDrawerMode("edit"); setForm(rowToForm(item)); setFormErrors({});
    setEditTarget(item); setShowSecret(false); setDrawerOpen(true);
  }

  function validate() {
    const errs: Partial<CredForm> = {};
    if (!form.clientId)     errs.clientId = "Required";
    if (!form.title.trim()) errs.title    = "Required";
    if (drawerMode === "create" && !form.secret) errs.secret = "Required";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function f(key: keyof CredForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setForm((p) => ({ ...p, [key]: e.target.value }));
        setFormErrors((p) => ({ ...p, [key]: undefined }));
      },
    };
  }

  async function handleExport() {
    setExporting(true); setExportConfirmOpen(false);
    try {
      const res = await fetch("/api/credentials/export", {
        credentials: "include",
        headers: { "X-Export-Confirm": "CONFIRMED" },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(j.error || `Export failed: ${res.status}`);
      }
      downloadBlob(await res.text(), `credentials-${new Date().toISOString().slice(0, 10)}.csv`);
      toast(`Exported ${list.data?.total ?? 0} credential${(list.data?.total ?? 0) !== 1 ? "s" : ""}`, "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    } finally { setExporting(false); }
  }

  async function handleImport() {
    if (!importFile) return;
    setImportLoading(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append("file", importFile);
      const res  = await fetch("/api/credentials/import", { method: "POST", credentials: "include", body: fd });
      const json = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "Import failed");
      setImportResult(json);
      if (json.inserted > 0) {
        queryClient.invalidateQueries({ queryKey: ["credentials"] });
        toast(`Imported ${json.inserted} credential${json.inserted !== 1 ? "s" : ""}`, "success");
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally { setImportLoading(false); }
  }

  const rows    = list.data?.items ?? [];
  const isSaving = create.isPending || update.isPending;

  /* ── copy to clipboard helper ── */
  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => toast("Copied", "success")).catch(() => {});
  }

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Vault</span>
          <h1 className="page-title">Credentials</h1>
          <p className="page-subtitle">AES-256-GCM encrypted. PIN required to reveal secrets.</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CRED_TEMPLATE_CSV, "credentials-template.csv")}>Template</Button>
          <Button variant="ghost" size="sm" icon={Icons.upload} onClick={() => { setImportFile(null); setImportResult(null); setImportOpen(true); }}>Import</Button>
          <Button variant="ghost" size="sm" icon={Icons.download} loading={exporting} onClick={() => setExportConfirmOpen(true)}>Export</Button>
          <Button variant="primary" icon={Icons.plus} onClick={openCreate}>New Credential</Button>
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
            placeholder="Search credentials…"
            className="filter-input"
            style={{ paddingLeft: 34, width: 230 }}
          />
        </div>
        <select value={clientId} onChange={(e) => { setClientId(e.target.value); setPage(1); }} className="filter-select" style={{ width: 155 }}>
          <option value="all">All clients</option>
          {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          {list.data && (
            <span style={{ fontSize: "0.775rem", color: "var(--fg-subtle)" }}>
              {list.data.total} credential{list.data.total !== 1 ? "s" : ""}
            </span>
          )}
          <ViewSwitcher view={view} onChange={(v) => setView(v as "table" | "cards")} options={VIEW_OPTS} />
        </div>
      </div>

      {/* ── Table view (default) ── */}
      {view === "table" && (
        <>
          {list.isLoading && !list.data && (
            <div style={{ padding: "8px 0" }}><SkeletonRows rows={8} height={42} /></div>
          )}
          {!list.isLoading && rows.length === 0 && (
            <EmptyState
              title="No credentials yet"
              description="Import a CSV or add credentials individually."
              action={<div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CRED_TEMPLATE_CSV, "credentials-template.csv")}>Template</Button>
                <Button variant="ghost" size="sm" icon={Icons.upload} onClick={() => { setImportFile(null); setImportResult(null); setImportOpen(true); }}>Import CSV</Button>
                <Button variant="primary" size="sm" icon={Icons.plus} onClick={openCreate}>New Credential</Button>
              </div>}
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
            />
          )}
          {rows.length > 0 && (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ minWidth: 900 }}>
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 4, width: 36 }}>#</th>
                      <th>Title</th>
                      <th>Client</th>
                      <th>IP Address</th>
                      <th>Username / Email</th>
                      <th style={{ minWidth: 200 }}>Password</th>
                      <th style={{ paddingRight: 4 }}>Added</th>
                      <th style={{ width: 72, paddingRight: 4 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item, index) => {
                      const isRevealed = !!revealed[item.id];
                      return (
                        <tr key={item.id}>
                          <td style={{ paddingLeft: 4, color: "var(--fg-subtle)", fontSize: "0.75rem" }}>
                            {(list.data?.offset ?? 0) + index + 1}
                          </td>
                          <td className="td-primary">{item.title}</td>
                          <td>{item.clientName ?? <span style={{ color: "var(--fg-subtle)" }}>—</span>}</td>
                          <td><IpLink ip={item.clientIp} /></td>
                          <td style={{ color: "var(--fg-muted)" }}>
                            {item.username || item.email
                              ? <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem" }}>{item.username ?? item.email}</span>
                              : <span style={{ color: "var(--fg-subtle)" }}>—</span>
                            }
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isRevealed ? (
                                <>
                                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.78rem", color: "var(--fg)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {revealed[item.id]}
                                  </span>
                                  {/* Copy */}
                                  <button
                                    title="Copy"
                                    onClick={() => copyText(revealed[item.id])}
                                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "var(--radius-xs)", border: "none", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", flexShrink: 0 }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.background = "var(--bg-subtle)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}
                                  >
                                    {Icons.copy}
                                  </button>
                                  {/* Hide */}
                                  <button
                                    onClick={() => setRevealed((r) => { const n = { ...r }; delete n[item.id]; return n; })}
                                    style={{ height: 20, padding: "0 7px", borderRadius: "var(--radius-xs)", border: "1px solid var(--border-strong)", background: "transparent", color: "var(--fg-subtle)", fontSize: "0.7rem", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; }}
                                  >
                                    Hide
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span style={{ letterSpacing: "0.15em", color: "var(--fg-subtle)", fontSize: "0.8rem", userSelect: "none" }}>••••••••</span>
                                  <button
                                    onClick={() => { setPinTarget(item.id); setPinError(null); }}
                                    style={{ display: "flex", alignItems: "center", gap: 4, height: 22, padding: "0 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: "0.72rem", fontWeight: 550, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)" }}
                                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--fg)"; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--fg-muted)"; }}
                                  >
                                    {Icons.eye} Reveal
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                          <td style={{ paddingRight: 4 }}><TimeAgo date={item.createdAt} /></td>
                          <td style={{ paddingRight: 4 }}>
                            <div style={{ display: "flex", gap: 2 }}>
                              <RowBtn title="Edit" color="default" onClick={() => openEdit(item)}>{Icons.pencil}</RowBtn>
                              <RowBtn title="Delete" color="danger" onClick={() => setDeleteTarget(item)}>{Icons.trash}</RowBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {list.data && list.data.total > 0 && (
                <Pagination page={page} total={list.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
              )}
            </>
          )}
        </>
      )}

      {/* ── Cards view ── */}
      {view === "cards" && (
        <>
          {list.isLoading && !list.data && (
            <div className="pin-grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={210} />)}</div>
          )}
          {!list.isLoading && rows.length === 0 && (
            <EmptyState
              title="No credentials yet"
              description="Import a CSV or add credentials individually."
              action={<Button variant="primary" size="sm" icon={Icons.plus} onClick={openCreate}>New Credential</Button>}
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>}
            />
          )}
          {rows.length > 0 && (
            <div className="pin-grid">
              {rows.map((item) => (
                <CredentialCard
                  key={item.id}
                  item={item}
                  revealedSecret={revealed[item.id]}
                  onReveal={() => { setPinTarget(item.id); setPinError(null); }}
                  onHide={() => setRevealed((r) => { const n = { ...r }; delete n[item.id]; return n; })}
                  onEdit={() => openEdit(item)}
                  onDelete={() => setDeleteTarget(item)}
                  onCopy={(s) => copyText(s)}
                />
              ))}
            </div>
          )}
          {list.data && list.data.total > 0 && (
            <div style={{ marginTop: 16 }}>
              <Pagination page={page} total={list.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        title={drawerMode === "create" ? "New Credential" : "Edit Credential"}
        subtitle={drawerMode === "create" ? "Encrypted with AES-256-GCM at rest." : `Editing: ${editTarget?.title ?? ""}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setDrawerOpen(false); setEditTarget(null); }} disabled={isSaving}>Cancel</Button>
            <Button variant="primary" size="sm" loading={isSaving} onClick={() => {
              if (!validate()) return;
              drawerMode === "edit" && editTarget
                ? update.mutate({ id: editTarget.id, body: form })
                : create.mutate(form);
            }}>
              {drawerMode === "create" ? "Save Credential" : "Save Changes"}
            </Button>
          </>
        }
      >
        <FormGrid>
          <FieldSelect label="Client" required error={formErrors.clientId} {...f("clientId")}>
            <option value="">Select a client…</option>
            {clients.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </FieldSelect>
          <FieldInput label="Title" required error={formErrors.title} placeholder="e.g. cPanel Login" {...f("title")} />
          <div>
            <label className="field-label">
              {drawerMode === "create" ? <>Password / Secret<span className="field-required">*</span></> : "New Password / Secret"}
              {drawerMode === "edit" && (
                <span style={{ fontSize: "0.7rem", color: "var(--fg-subtle)", fontWeight: 400, marginLeft: 6 }}>
                  (leave blank to keep current)
                </span>
              )}
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showSecret ? "text" : "password"}
                autoComplete="new-password"
                placeholder={drawerMode === "create" ? "Enter the secret…" : "Enter new secret to change…"}
                {...f("secret")}
                className={`field-input${formErrors.secret ? " error" : ""}`}
                style={{ paddingRight: 36 }}
                onFocus={(e) => { if (!formErrors.secret) e.currentTarget.style.borderColor = "var(--border-focus)"; }}
                onBlur={(e)  => { if (!formErrors.secret) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
              />
              <button type="button" onClick={() => setShowSecret((v) => !v)}
                style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fg-subtle)", cursor: "pointer", padding: 0, display: "flex" }}>
                {showSecret ? Icons.eyeOff : Icons.eye}
              </button>
            </div>
            {formErrors.secret && <p className="field-error">{formErrors.secret}</p>}
          </div>
          <FormRow>
            <FieldInput label="Username" placeholder="johndoe" {...f("username")} />
            <FieldInput label="Email" type="email" placeholder="john@example.com" {...f("email")} />
          </FormRow>
          <div>
            <label className="field-label">Notes</label>
            <textarea rows={3} placeholder="Optional notes…" {...f("notes")} className="field-textarea" />
          </div>
        </FormGrid>
      </Drawer>

      {/* ── Import Drawer ── */}
      <Drawer
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
        title="Import Credentials"
        subtitle="Upload a CSV. Secrets are encrypted automatically."
        footer={
          !importResult ? (
            <>
              <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CRED_TEMPLATE_CSV, "credentials-template.csv")}>Download Template</Button>
              <div style={{ flex: 1 }} />
              <Button variant="ghost" size="sm" onClick={() => { setImportOpen(false); setImportFile(null); }}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={!importFile} loading={importLoading} onClick={handleImport} icon={Icons.upload}>Import</Button>
            </>
          ) : (
            <Button variant="primary" size="sm" onClick={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}>Done</Button>
          )
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--status-info-bg)", border: "1px solid rgba(29,78,216,0.15)", borderRadius: "var(--radius-lg)", padding: "11px 14px" }}>
            <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--status-info-fg)", marginBottom: 4 }}>Expected CSV columns</p>
            <code style={{ display: "block", fontSize: "0.72rem", fontFamily: "ui-monospace, monospace", color: "var(--status-info-fg)", lineHeight: 1.7, background: "rgba(29,78,216,0.06)", borderRadius: "var(--radius-sm)", padding: "6px 8px" }}>
              client_name, title, username, email, secret, notes
            </code>
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--status-info-fg)", opacity: 0.8 }}>
              <strong>client_name</strong>, <strong>title</strong> and <strong>secret</strong> are required.
            </p>
          </div>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start", background: "var(--status-wip-bg)", border: "1px solid rgba(180,83,9,0.18)", borderRadius: "var(--radius-lg)", padding: "10px 13px" }}>
            <span style={{ color: "var(--status-wip-fg)", flexShrink: 0, marginTop: 1 }}>{Icons.shield}</span>
            <p style={{ fontSize: "0.775rem", color: "var(--status-wip-fg)", lineHeight: 1.5 }}>CSV will contain plaintext secrets. Use HTTPS and delete after import.</p>
          </div>
          {!importResult && (
            <div
              style={{ border: `2px dashed ${importDragOver ? "var(--accent)" : importFile ? "#22c55e" : "var(--border-strong)"}`, borderRadius: "var(--radius-xl)", padding: "28px 20px", textAlign: "center", cursor: "pointer", background: importFile ? "#ecfdf5" : importDragOver ? "var(--bg-subtle)" : "var(--surface-raised)", transition: "all var(--dur-fast) var(--ease-out)" }}
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setImportDragOver(false); const fi = e.dataTransfer.files[0]; if (fi) { setImportFile(fi); setImportResult(null); } }}
              onClick={() => importFileRef.current?.click()}
            >
              <input ref={importFileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const fi = e.target.files?.[0]; if (fi) { setImportFile(fi); setImportResult(null); } e.target.value = ""; }} />
              {importFile ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "var(--radius-pill)", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "#15803d" }}>{importFile.name}</p>
                  <p style={{ fontSize: "0.775rem", color: "var(--fg-subtle)" }}>{(importFile.size / 1024).toFixed(1)} KB · Click to change</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: "var(--radius-pill)", background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--fg-muted)" }}>{Icons.upload}</div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--fg-muted)" }}>Drop CSV here or <span style={{ color: "var(--fg)", textDecoration: "underline" }}>browse</span></p>
                </div>
              )}
            </div>
          )}
          {importResult && <ImportResultPanel result={importResult} entityName="credential" />}
        </div>
      </Drawer>

      {/* ── Export Confirm ── */}
      {exportConfirmOpen && (
        <>
          <div className="modal-backdrop" onClick={() => setExportConfirmOpen(false)} />
          <div className="modal-panel" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Export credentials?</h2>
                <p className="modal-subtitle">Downloads a CSV with decrypted plaintext secrets.</p>
              </div>
              <button className="modal-close-btn" onClick={() => setExportConfirmOpen(false)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--status-inactive-bg)", border: "1px solid rgba(185,28,28,0.18)", borderRadius: "var(--radius-lg)", padding: "12px 14px" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "#b91c1c", marginBottom: 3 }}>Sensitive data warning</p>
                  <p style={{ fontSize: "0.775rem", color: "var(--status-inactive-fg)", lineHeight: 1.55 }}>
                    The file will contain <strong>all plaintext passwords</strong>. Delete it when done.
                  </p>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <Button variant="ghost" size="sm" onClick={() => setExportConfirmOpen(false)}>Cancel</Button>
              <Button variant="danger" size="sm" loading={exporting} onClick={handleExport}>Export Anyway</Button>
            </div>
          </div>
        </>
      )}

      {/* ── Modals ── */}
      <PinModal
        open={!!pinTarget}
        onClose={() => { setPinTarget(null); setPinError(null); }}
        onSubmit={(pin) => pinTarget && handleReveal(pinTarget, pin)}
        loading={pinLoading} error={pinError}
      />
      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)}
        title="Delete credential"
        description={`Permanently delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete" danger loading={remove.isPending}
      />
    </div>
  );
}

/* ── Row action button ── */
function RowBtn({ children, onClick, title, color }: {
  children: React.ReactNode; onClick: () => void; title: string; color: "default" | "danger";
}) {
  return (
    <button title={title} onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--radius-md)", border: "none", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = color === "danger" ? "#b91c1c" : "var(--fg)"; e.currentTarget.style.background = color === "danger" ? "#fef2f2" : "var(--bg-subtle)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}

/* ── Credential card (cards view) ── */
function CredentialCard({ item, revealedSecret, onReveal, onHide, onEdit, onDelete, onCopy }: {
  item: Row; revealedSecret?: string;
  onReveal: () => void; onHide: () => void;
  onEdit: () => void; onDelete: () => void;
  onCopy: (s: string) => void;
}) {
  const gradient   = serviceGradient(item.title);
  const isRevealed = !!revealedSecret;

  return (
    <div className="pin-card pin-card--locked" style={{ cursor: "default" }}>
      <div className="pin-thumb" style={{ height: 110, background: gradient, position: "relative" }}>
        <span className="pin-badge" style={{ left: "auto", right: 10 }}>AES-256</span>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 40, height: 40, borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          </div>
        </div>
        <div className="pin-actions" onClick={(e) => e.stopPropagation()}>
          <button className="pin-action-btn" title="Edit" onClick={onEdit}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button className="pin-action-btn" title="Delete" onClick={onDelete} style={{ color: "#b91c1c" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)", backgroundSize: "16px 16px", pointerEvents: "none" }} />
      </div>

      <div className="pin-body">
        <p className="pin-title">{item.title}</p>
        {item.clientName && <div className="pin-meta"><span className="pin-meta-text">{item.clientName}</span>{item.clientIp && <><span style={{ color: "var(--border-strong)" }}>·</span><span className="pin-meta-text" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem" }}>{item.clientIp}</span></>}</div>}
        {(item.username || item.email) && (
          <p style={{ fontSize: "0.75rem", color: "var(--fg-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.username ?? item.email}
          </p>
        )}

        <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
          {isRevealed ? (
            <>
              <span style={{ flex: 1, fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {revealedSecret}
              </span>
              <button onClick={() => onCopy(revealedSecret!)}
                style={{ background: "none", border: "none", color: "var(--fg-subtle)", cursor: "pointer", display: "flex", flexShrink: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-subtle)")}
                title="Copy">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
              </button>
              <button onClick={onHide} style={{ background: "none", border: "none", color: "var(--fg-subtle)", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline", textUnderlineOffset: "2px", whiteSpace: "nowrap", flexShrink: 0 }}>
                Hide
              </button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, letterSpacing: "0.18em", color: "var(--fg-subtle)", fontSize: "0.8rem" }}>••••••••</span>
              <button onClick={onReveal}
                style={{ display: "flex", alignItems: "center", gap: 3, height: 22, padding: "0 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--fg-muted)", fontSize: "0.7rem", fontWeight: 550, cursor: "pointer", transition: "background var(--dur-fast), color var(--dur-fast)", whiteSpace: "nowrap", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--fg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--fg-muted)"; }}>
                Reveal
              </button>
            </>
          )}
        </div>
        <div style={{ marginTop: 6 }}><TimeAgo date={item.createdAt} /></div>
      </div>
    </div>
  );
}
