"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button, clientGradient, DelegatedBadge, EmptyState,
  IpLink, Mono, Pagination, SkeletonCard, TimeAgo,
} from "@/components/ui";
import { ConfirmModal, Drawer, FieldInput, FieldSelect, FormGrid, FormRow, useToast } from "@/components/modals";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiGet, apiSend } from "@/lib/api-client";

/* ============================================================
   TYPES
   ============================================================ */
type ClientRow = {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  ipAddress: string | null;
  tpin: string;
  delegatedTo: string | null;
  delegatedStatus: "UNASSIGNED" | "LAST_ACTIVE" | "INACTIVE" | "WIP" | "CUSTOM";
  createdAt: string;
};

type Payload = {
  items: ClientRow[];
  total: number;
  page: number;
  pageSize: 20 | 50 | 100 | "all";
  offset: number;
};

type ClientForm = {
  name: string; tpin: string; contact: string;
  address: string; ipAddress: string;
  delegatedTo: string; delegatedStatus: string;
};

type ImportResult = { inserted: number; errors: Array<{ row: number; message: string }> };

const EMPTY_FORM: ClientForm = {
  name: "", tpin: "", contact: "", address: "",
  ipAddress: "", delegatedTo: "", delegatedStatus: "UNASSIGNED",
};

/* Strip any non-digit characters from TPIN before saving */
function sanitizeTpin(raw: string): string {
  return raw.replace(/\D/g, "");
}

/* ── CLIENT CSV TEMPLATE ── */
const CLIENT_TEMPLATE_CSV =
  "name,tpin,contact,address,ip_address,delegated_to,delegated_status\n" +
  "Acme Corporation,12345,john@acme.com,\"123 Main St, City\",192.168.1.1,John Doe,LAST_ACTIVE\n" +
  "Global Tech,67890,sarah@globaltech.com,,,,UNASSIGNED";

/* ============================================================
   ICONS
   ============================================================ */
const Icons = {
  plus: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  pencil: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>,
  trash: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6M9 6V4h6v2" /></svg>,
  download: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>,
  upload: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>,
  template: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
};

/* ============================================================
   HELPERS
   ============================================================ */
const AVATAR_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#14b8a6"];
function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}
function downloadBlob(content: string, filename: string, mime = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
function rowToForm(item: ClientRow): ClientForm {
  return {
    name:            item.name,
    tpin:            item.tpin,
    contact:         item.contact         ?? "",
    address:         item.address         ?? "",
    ipAddress:       item.ipAddress       ?? "",
    delegatedTo:     item.delegatedTo     ?? "",
    delegatedStatus: item.delegatedStatus,
  };
}

/* ============================================================
   PAGE
   ============================================================ */
export default function ClientsPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [pageSize, setPageSize]         = useState<20 | 50 | 100 | "all">(20);
  const [delegatedStatus, setDelegated] = useState("all");
  const [view, setView]                 = useState<"cards" | "table">("table");

  /* drawer: mode = "create" | "edit" */
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [drawerMode, setDrawerMode]   = useState<"create" | "edit">("create");
  const [editTarget, setEditTarget]   = useState<ClientRow | null>(null);
  const [form, setForm]               = useState<ClientForm>(EMPTY_FORM);
  const [formErrors, setFormErrors]   = useState<Partial<ClientForm>>({});

  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);

  /* import */
  const [importOpen, setImportOpen]       = useState(false);
  const [importFile, setImportFile]       = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult]   = useState<ImportResult | null>(null);
  const [importDragOver, setImportDragOver] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 250);
  const queryKey = useMemo(
    () => ["clients", debouncedSearch, page, pageSize, delegatedStatus],
    [debouncedSearch, page, pageSize, delegatedStatus],
  );

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => apiGet<Payload>(
      `/api/clients?search=${encodeURIComponent(debouncedSearch)}&page=${page}&pageSize=${pageSize}&delegatedStatus=${delegatedStatus}`,
    ),
    placeholderData: (prev) => prev,
  });

  /* ── create ── */
  const createMutation = useMutation({
    mutationFn: (body: ClientForm) =>
      apiSend<{ item: ClientRow }>("/api/clients", "POST", {
        name:            body.name.trim(),
        tpin:            sanitizeTpin(body.tpin),
        contact:         body.contact.trim()     || undefined,
        address:         body.address.trim()     || undefined,
        ipAddress:       body.ipAddress.trim()   || undefined,
        delegatedTo:     body.delegatedTo.trim() || undefined,
        delegatedStatus: body.delegatedStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-options"] });
      setDrawerOpen(false); setForm(EMPTY_FORM);
      toast("Client created", "success");
      apiSend<{ matched: number }>("/api/files/rematch", "POST")
        .then(({ matched }) => {
          if (matched > 0) {
            queryClient.invalidateQueries({ queryKey: ["files"] });
            toast(`${matched} unmatched file${matched !== 1 ? "s" : ""} auto-sorted to this client`, "success");
          }
        }).catch(() => {});
    },
    onError: (e: Error) => toast(e.message || "Failed to create client", "error"),
  });

  /* ── update ── */
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ClientForm }) =>
      apiSend<{ item: ClientRow }>(`/api/clients/${id}`, "PUT", {
        name:            body.name.trim(),
        tpin:            sanitizeTpin(body.tpin),
        contact:         body.contact.trim()     || null,
        address:         body.address.trim()     || null,
        ipAddress:       body.ipAddress.trim()   || null,
        delegatedTo:     body.delegatedTo.trim() || null,
        delegatedStatus: body.delegatedStatus,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["client-options"] });
      setDrawerOpen(false); setEditTarget(null);
      toast("Client updated", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to update client", "error"),
  });

  /* ── delete ── */
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiSend<{ ok: true }>(`/api/clients/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setDeleteTarget(null);
      toast("Client deleted", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to delete client", "error"),
  });

  useEffect(() => {
    if (!data || pageSize === "all") return;
    const max = Math.max(1, Math.ceil(data.total / (pageSize as number)));
    if (page > max) setPage(max);
  }, [data, page, pageSize]);

  function openCreate() {
    setDrawerMode("create"); setForm(EMPTY_FORM); setFormErrors({}); setEditTarget(null); setDrawerOpen(true);
  }
  function openEdit(item: ClientRow) {
    setDrawerMode("edit"); setForm(rowToForm(item)); setFormErrors({}); setEditTarget(item); setDrawerOpen(true);
  }

  function validate() {
    const errs: Partial<ClientForm> = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!sanitizeTpin(form.tpin)) errs.tpin = "Required (numbers only)";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function f(key: keyof ClientForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        /* For tpin, strip non-digits live */
        const val = key === "tpin" ? e.target.value.replace(/\D/g, "") : e.target.value;
        setForm((p) => ({ ...p, [key]: val }));
        setFormErrors((p) => ({ ...p, [key]: undefined }));
      },
    };
  }

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/clients/export", { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      downloadBlob(await res.text(), `clients-${new Date().toISOString().slice(0, 10)}.csv`);
      toast(`Exported ${data?.total ?? 0} client${(data?.total ?? 0) !== 1 ? "s" : ""}`, "success");
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Export failed", "error");
    } finally { setExporting(false); }
  }

  async function handleImport() {
    if (!importFile) return;
    setImportLoading(true); setImportResult(null);
    try {
      const fd = new FormData(); fd.append("file", importFile);
      const res = await fetch("/api/clients/import", { method: "POST", credentials: "include", body: fd });
      const json = (await res.json()) as ImportResult & { error?: string };
      if (!res.ok) throw new Error(json.error || "Import failed");
      setImportResult(json);
      if (json.inserted > 0) {
        queryClient.invalidateQueries({ queryKey: ["clients"] });
        queryClient.invalidateQueries({ queryKey: ["client-options"] });
        toast(`Imported ${json.inserted} client${json.inserted !== 1 ? "s" : ""}`, "success");
        apiSend<{ matched: number }>("/api/files/rematch", "POST")
          .then(({ matched }) => { if (matched > 0) { queryClient.invalidateQueries({ queryKey: ["files"] }); toast(`${matched} unmatched file${matched !== 1 ? "s" : ""} auto-sorted`, "success"); } })
          .catch(() => {});
      }
    } catch (e: unknown) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally { setImportLoading(false); }
  }

  const rows = data?.items ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Directory</span>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">Manage your client directory, TPIN records, and delegations.</p>
        </div>
        <div className="page-actions">
          <button onClick={() => setView(view === "cards" ? "table" : "cards")} className="btn-ghost btn-sm">
            {view === "cards"
              ? <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /></svg> Table</>
              : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> Cards</>
            }
          </button>
          <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CLIENT_TEMPLATE_CSV, "clients-template.csv")}>Template</Button>
          <Button variant="ghost" size="sm" icon={Icons.upload} onClick={() => { setImportFile(null); setImportResult(null); setImportOpen(true); }}>Import</Button>
          <Button variant="ghost" size="sm" icon={Icons.download} loading={exporting} onClick={handleExport}>Export</Button>
          <Button variant="primary" icon={Icons.plus} onClick={openCreate}>Add Client</Button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, TPIN, contact…" className="filter-input" style={{ paddingLeft: 34, width: 240 }} />
        </div>
        <select value={delegatedStatus} onChange={(e) => { setDelegated(e.target.value); setPage(1); }} className="filter-select" style={{ width: 150 }}>
          <option value="all">All statuses</option>
          <option value="UNASSIGNED">Unassigned</option>
          <option value="LAST_ACTIVE">Last Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="WIP">In Progress</option>
          <option value="CUSTOM">Custom</option>
        </select>
        {data && <span style={{ marginLeft: "auto", fontSize: "0.775rem", color: "var(--fg-subtle)" }}>{data.total} client{data.total !== 1 ? "s" : ""}</span>}
      </div>

      {/* ── Card view ── */}
      {view === "cards" && (
        <>
          {isLoading && !data && <div className="pin-grid">{Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} height={200} />)}</div>}
          {!isLoading && rows.length === 0 && (
            <EmptyState
              title="No clients yet"
              description="Add your first client manually or import a CSV to get started."
              action={<div style={{ display: "flex", gap: 8 }}>
                <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CLIENT_TEMPLATE_CSV, "clients-template.csv")}>Template</Button>
                <Button variant="ghost" size="sm" icon={Icons.upload} onClick={() => { setImportFile(null); setImportResult(null); setImportOpen(true); }}>Import CSV</Button>
                <Button variant="primary" size="sm" icon={Icons.plus} onClick={openCreate}>Add Client</Button>
              </div>}
              icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>}
            />
          )}
          {rows.length > 0 && (
            <div className="pin-grid">
              {rows.map((item) => (
                <ClientCard key={item.id} item={item} onEdit={() => openEdit(item)} onDelete={() => setDeleteTarget(item)} />
              ))}
            </div>
          )}
          {data && data.total > 0 && (
            <div style={{ marginTop: 16 }}>
              <Pagination page={page} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
            </div>
          )}
        </>
      )}

      {/* ── Table view ── */}
      {view === "table" && (
        <>
          {isLoading && !data ? (
            <div style={{ padding: "8px 0" }}>{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 40, marginBottom: 6 }} />)}</div>
          ) : rows.length === 0 ? (
            <EmptyState title="No clients" description="No clients match your current filters." icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /></svg>} />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ minWidth: 860 }}>
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 20, width: 40 }}>#</th>
                    <th>Client Name</th>
                    <th>Contact</th>
                    <th>Address</th>
                    <th>IP Address</th>
                    <th>TPIN</th>
                    <th>Delegated To</th>
                    <th>Status</th>
                    <th style={{ paddingRight: 20 }}>Added</th>
                    <th style={{ width: 72, paddingRight: 16 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item, index) => (
                    <tr key={item.id}>
                      <td style={{ paddingLeft: 20, color: "var(--fg-subtle)" }}>{(data?.offset ?? 0) + index + 1}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "var(--radius-pill)", background: avatarColor(item.name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                            {initials(item.name)}
                          </div>
                          <span className="td-primary">{item.name}</span>
                        </div>
                      </td>
                      <td>{item.contact ?? <span style={{ color: "var(--fg-subtle)" }}>—</span>}</td>
                      <td><span title={item.address ?? ""} style={{ display: "block", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.address ?? <span style={{ color: "var(--fg-subtle)" }}>—</span>}</span></td>
                      <td><IpLink ip={item.ipAddress} /></td>
                      <td><Mono>{item.tpin}</Mono></td>
                      <td>{item.delegatedTo ?? <span style={{ color: "var(--fg-subtle)" }}>—</span>}</td>
                      <td><DelegatedBadge status={item.delegatedStatus} /></td>
                      <td style={{ paddingRight: 20 }}><TimeAgo date={item.createdAt} /></td>
                      <td style={{ paddingRight: 16 }}>
                        <div style={{ display: "flex", gap: 2 }}>
                          <ActionBtn title="Edit" onClick={() => openEdit(item)} color="default">
                            {Icons.pencil}
                          </ActionBtn>
                          <ActionBtn title="Delete" onClick={() => setDeleteTarget(item)} color="danger">
                            {Icons.trash}
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {data && data.total > 0 && (
            <div style={{ paddingTop: 14 }}>
              <Pagination page={page} total={data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit Drawer ── */}
      <Drawer
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setEditTarget(null); }}
        title={drawerMode === "create" ? "Add Client" : "Edit Client"}
        subtitle={drawerMode === "create" ? "Create a new client record." : `Editing ${editTarget?.name ?? ""}`}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => { setDrawerOpen(false); setEditTarget(null); }} disabled={isSaving}>Cancel</Button>
            <Button
              variant="primary" size="sm" loading={isSaving}
              onClick={() => {
                if (!validate()) return;
                if (drawerMode === "edit" && editTarget) {
                  updateMutation.mutate({ id: editTarget.id, body: form });
                } else {
                  createMutation.mutate(form);
                }
              }}
            >
              {drawerMode === "create" ? "Create Client" : "Save Changes"}
            </Button>
          </>
        }
      >
        <FormGrid>
          <FormRow>
            <FieldInput label="Client Name" required error={formErrors.name} placeholder="Acme Corporation" {...f("name")} />
            <FieldInput label="TPIN" required error={formErrors.tpin} placeholder="12345" inputMode="numeric" {...f("tpin")} />
          </FormRow>
          <FieldInput label="Contact" placeholder="john@acme.com" {...f("contact")} />
          <FieldInput label="Address" placeholder="123 Main St, City" {...f("address")} />
          <FieldInput label="IP Address" placeholder="192.168.1.1" {...f("ipAddress")} />
          <FormRow>
            <FieldInput label="Delegated To" placeholder="Person or team" {...f("delegatedTo")} />
            <FieldSelect label="Status" {...f("delegatedStatus")}>
              <option value="UNASSIGNED">Unassigned</option>
              <option value="LAST_ACTIVE">Last Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="WIP">In Progress</option>
              <option value="CUSTOM">Custom</option>
            </FieldSelect>
          </FormRow>
        </FormGrid>
      </Drawer>

      {/* ── Import Drawer ── */}
      <Drawer
        open={importOpen}
        onClose={() => { setImportOpen(false); setImportResult(null); setImportFile(null); }}
        title="Import Clients"
        subtitle="Upload a CSV file to bulk-create clients."
        footer={
          !importResult ? (
            <>
              <Button variant="ghost" size="sm" icon={Icons.template} onClick={() => downloadBlob(CLIENT_TEMPLATE_CSV, "clients-template.csv")}>Download Template</Button>
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
              name, tpin, contact, address, ip_address, delegated_to, delegated_status
            </code>
            <p style={{ marginTop: 6, fontSize: "0.75rem", color: "var(--status-info-fg)", opacity: 0.8 }}>
              Only <strong>name</strong> and <strong>tpin</strong> are required. TPIN should be numbers only.
            </p>
          </div>
          {!importResult && (
            <div
              style={{ border: `2px dashed ${importDragOver ? "var(--accent)" : importFile ? "#22c55e" : "var(--border-strong)"}`, borderRadius: "var(--radius-xl)", padding: "28px 20px", textAlign: "center", cursor: "pointer", background: importFile ? "#ecfdf5" : importDragOver ? "var(--bg-subtle)" : "var(--surface-raised)", transition: "all var(--dur-fast) var(--ease-out)" }}
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setImportDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setImportFile(f); setImportResult(null); } }}
              onClick={() => importFileRef.current?.click()}
            >
              <input ref={importFileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) { setImportFile(f); setImportResult(null); } e.target.value = ""; }} />
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
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--fg-muted)" }}>Drop your CSV here or <span style={{ color: "var(--fg)", textDecoration: "underline" }}>browse</span></p>
                  <p style={{ fontSize: "0.775rem", color: "var(--fg-subtle)" }}>CSV files only</p>
                </div>
              )}
            </div>
          )}
          {importResult && <ImportResultPanel result={importResult} entityName="client" />}
        </div>
      </Drawer>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        title="Delete client"
        description={`Permanently delete "${deleteTarget?.name}" and all associated files and credentials? This cannot be undone.`}
        confirmLabel="Delete Client" danger loading={deleteMutation.isPending}
      />
    </div>
  );
}

/* ============================================================
   IMPORT RESULT PANEL  (exported — used by credentials page too)
   ============================================================ */
export function ImportResultPanel({ result, entityName }: { result: ImportResult; entityName: string }) {
  const { inserted, errors } = result;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 10 }}>
        {[
          { count: inserted, label: `${entityName}${inserted !== 1 ? "s" : ""} imported`, ok: inserted > 0, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={inserted > 0 ? "#15803d" : "var(--fg-subtle)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> },
          { count: errors.length, label: `row${errors.length !== 1 ? "s" : ""} failed`, ok: errors.length === 0, icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={errors.length > 0 ? "#b91c1c" : "var(--fg-subtle)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> },
        ].map(({ count, label, ok, icon }, i) => (
          <div key={i} style={{ flex: 1, padding: "12px 14px", borderRadius: "var(--radius-lg)", background: ok ? "var(--status-active-bg)" : (count > 0 ? "var(--status-inactive-bg)" : "var(--status-neutral-bg)"), border: `1px solid ${ok ? "rgba(21,128,61,0.2)" : count > 0 ? "rgba(185,28,28,0.2)" : "var(--border)"}`, display: "flex", alignItems: "center", gap: 9 }}>
            {icon}
            <div>
              <p style={{ fontSize: "1rem", fontWeight: 650, color: ok ? "#15803d" : count > 0 ? "#b91c1c" : "var(--fg-muted)", lineHeight: 1 }}>{count}</p>
              <p style={{ fontSize: "0.73rem", color: ok ? "#15803d" : count > 0 ? "#b91c1c" : "var(--fg-subtle)", marginTop: 2 }}>{label}</p>
            </div>
          </div>
        ))}
      </div>
      {errors.length > 0 && (
        <div style={{ background: "var(--surface-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <p style={{ padding: "8px 12px", fontSize: "0.7rem", fontWeight: 650, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)" }}>Failed rows</p>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {errors.map((err, i) => (
              <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 12px", borderBottom: i < errors.length - 1 ? "1px solid var(--border)" : "none" }}>
                <span style={{ flexShrink: 0, fontSize: "0.68rem", fontWeight: 650, color: "#b91c1c", fontFamily: "ui-monospace, monospace", background: "#fef2f2", padding: "1px 5px", borderRadius: "3px" }}>Row {err.row}</span>
                <span style={{ fontSize: "0.775rem", color: "var(--fg-muted)", lineHeight: 1.4 }}>{err.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   CLIENT PIN CARD
   ============================================================ */
function ClientCard({ item, onEdit, onDelete }: { item: ClientRow; onEdit: () => void; onDelete: () => void }) {
  const gradient = clientGradient(item.name);
  const color    = avatarColor(item.name);
  const init     = initials(item.name);

  return (
    <div className="pin-card pin-card--client" style={{ cursor: "default" }}>
      <div className="pin-thumb" style={{ height: 110, background: gradient, position: "relative" }}>
        <div className="pin-actions" onClick={(e) => e.stopPropagation()}>
          <button className="pin-action-btn" title="Edit" onClick={onEdit}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          </button>
          <button className="pin-action-btn" title="Delete" onClick={onDelete} style={{ color: "#b91c1c" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          </button>
        </div>
        <span className="pin-badge" style={{ color: { LAST_ACTIVE: "#15803d", WIP: "#b45309", INACTIVE: "#b91c1c", UNASSIGNED: "#57534e", CUSTOM: "#1d4ed8" }[item.delegatedStatus] ?? "var(--fg)" }}>
          {{ LAST_ACTIVE: "Last Active", WIP: "In Progress", INACTIVE: "Inactive", UNASSIGNED: "Unassigned", CUSTOM: "Custom" }[item.delegatedStatus] ?? item.delegatedStatus}
        </span>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)", backgroundSize: "18px 18px", pointerEvents: "none" }} />
      </div>
      <div style={{ padding: "0 16px", position: "relative", marginTop: -18 }}>
        <div style={{ width: 36, height: 36, borderRadius: "var(--radius-pill)", background: color, border: "2.5px solid var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#fff", boxShadow: "var(--shadow-sm)" }}>
          {init}
        </div>
      </div>
      <div className="pin-body" style={{ paddingTop: 6 }}>
        <p className="pin-title">{item.name}</p>
        <div className="pin-meta">
          {item.contact && <span className="pin-meta-text">{item.contact}</span>}
          {item.contact && <span style={{ color: "var(--border-strong)" }}>·</span>}
          <span className="pin-meta-text" style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem" }}>{item.tpin}</span>
        </div>
        {item.address && <p className="pin-meta-text" style={{ marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.address}</p>}
        {item.ipAddress && <div style={{ marginTop: 6 }}><IpLink ip={item.ipAddress} /></div>}
        {item.delegatedTo && <p style={{ marginTop: 4, fontSize: "0.75rem", color: "var(--fg-muted)" }}>→ {item.delegatedTo}</p>}
        <div style={{ marginTop: 6 }}><TimeAgo date={item.createdAt} /></div>
      </div>
    </div>
  );
}

/* ── Small icon action button for table rows ── */
function ActionBtn({ children, onClick, title, color }: {
  children: React.ReactNode; onClick: () => void; title: string; color: "default" | "danger";
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "var(--radius-md)", border: "none", background: "transparent", color: "var(--fg-subtle)", cursor: "pointer", transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)" }}
      onMouseEnter={(e) => { e.currentTarget.style.color = color === "danger" ? "#b91c1c" : "var(--fg)"; e.currentTarget.style.background = color === "danger" ? "#fef2f2" : "var(--bg-subtle)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}
    >
      {children}
    </button>
  );
}
