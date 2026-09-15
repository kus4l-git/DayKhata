"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Button, EmptyState, Pagination, RoleBadge, SkeletonCard, TimeAgo,
} from "@/components/ui";
import { ConfirmModal, Drawer, FieldInput, FieldSelect, FormGrid, FormRow, useToast } from "@/components/modals";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiGet, apiSend } from "@/lib/api-client";

type Row = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string;
};

type NewForm = { email: string; name: string; password: string; pin: string; role: "ADMIN" | "STAFF" };
const EMPTY: NewForm = { email: "", name: "", password: "", pin: "", role: "STAFF" };

/* deterministic avatar hue from name */
const RING_COLORS = [
  "#6366f1","#ec4899","#f59e0b","#10b981",
  "#3b82f6","#8b5cf6","#ef4444","#14b8a6",
  "#f97316","#06b6d4",
];
function ringColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return RING_COLORS[h % RING_COLORS.length];
}
function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

const Icons = {
  plus: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  eyeOff: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>,
  eye: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>,
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const [search, setSearch]         = useState("");
  const [page, setPage]             = useState(1);
  const [pageSize, setPageSize]     = useState<20 | 50 | 100 | "all">(20);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm]             = useState<NewForm>(EMPTY);
  const [formErrors, setFormErrors] = useState<Partial<NewForm>>({});
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [showPwd, setShowPwd]       = useState(false);

  const debounced = useDebouncedValue(search, 250);
  const queryKey  = useMemo(() => ["users", debounced, page, pageSize], [debounced, page, pageSize]);

  const list = useQuery({
    queryKey,
    queryFn: () => apiGet<{ items: Row[]; total: number; offset: number }>(
      `/api/users?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${pageSize}`,
    ),
    placeholderData: (p) => p,
  });

  const addMutation = useMutation({
    mutationFn: (b: NewForm) => apiSend("/api/users", "POST", { email: b.email.trim(), name: b.name.trim(), password: b.password, pin: b.pin, role: b.role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDrawerOpen(false); setForm(EMPTY);
      toast("User created", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to create user", "error"),
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => apiSend(`/api/users/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeleteTarget(null);
      toast("User deleted", "success");
    },
    onError: (e: Error) => toast(e.message || "Failed to delete user", "error"),
  });

  function validate() {
    const errs: Partial<NewForm> = {};
    if (!form.email.trim()) errs.email = "Required";
    if (!form.name.trim())  errs.name  = "Required";
    if (!form.password || form.password.length < 8) errs.password = "Min 8 characters";
    if (!form.pin || form.pin.length < 4)           errs.pin      = "Min 4 digits";
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function f(key: keyof NewForm) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((p) => ({ ...p, [key]: e.target.value }));
        setFormErrors((p) => ({ ...p, [key]: undefined }));
      },
    };
  }

  const rows = list.data?.items ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Team</span>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">Manage team access and role assignments. One super admin is enforced.</p>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={Icons.plus} onClick={() => { setForm(EMPTY); setFormErrors({}); setShowPwd(false); setDrawerOpen(true); }}>
            New User
          </Button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-input-wrap">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search users…" className="filter-input" style={{ paddingLeft: 34, width: 230 }} />
        </div>
        {list.data && <span style={{ marginLeft: "auto", fontSize: "0.775rem", color: "var(--fg-subtle)" }}>{list.data.total} user{list.data.total !== 1 ? "s" : ""}</span>}
      </div>

      {list.isLoading && !list.data && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} height={200} />)}
        </div>
      )}

      {!list.isLoading && rows.length === 0 && (
        <EmptyState
          title="No users"
          description="Create team members and assign their permissions."
          action={<Button variant="primary" size="sm" icon={Icons.plus} onClick={() => { setForm(EMPTY); setDrawerOpen(true); }}>New User</Button>}
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
        />
      )}

      {rows.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 18 }}>
          {rows.map((row) => (
            <UserCard key={row.id} row={row} onDelete={row.role !== "SUPER_ADMIN" ? () => setDeleteTarget(row) : undefined} />
          ))}
        </div>
      )}

      {list.data && list.data.total > 0 && (
        <div style={{ marginTop: 16 }}>
          <Pagination page={page} total={list.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}

      <Drawer
        open={drawerOpen} onClose={() => setDrawerOpen(false)}
        title="New User" subtitle="Add a team member and assign their role."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)} disabled={addMutation.isPending}>Cancel</Button>
            <Button variant="primary" size="sm" loading={addMutation.isPending} onClick={() => { if (validate()) addMutation.mutate(form); }}>Create User</Button>
          </>
        }
      >
        <FormGrid>
          <FormRow>
            <FieldInput label="Full name" required error={formErrors.name} placeholder="Jane Smith" {...f("name")} />
            <FieldInput label="Email" type="email" required error={formErrors.email} placeholder="jane@company.com" {...f("email")} />
          </FormRow>
          <div>
            <label className="field-label">Password<span className="field-required">*</span></label>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} autoComplete="new-password" placeholder="Min 8 characters" {...f("password")} className={`field-input${formErrors.password ? " error" : ""}`} style={{ paddingRight: 36 }} onFocus={(e) => { if (!formErrors.password) e.currentTarget.style.borderColor = "var(--border-focus)"; }} onBlur={(e) => { if (!formErrors.password) e.currentTarget.style.borderColor = "var(--border-strong)"; }} />
              <button type="button" onClick={() => setShowPwd((v) => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--fg-subtle)", cursor: "pointer", padding: 0, display: "flex" }}>{showPwd ? Icons.eyeOff : Icons.eye}</button>
            </div>
            {formErrors.password && <p className="field-error">{formErrors.password}</p>}
          </div>
          <FormRow>
            <FieldInput label="PIN" required error={formErrors.pin} placeholder="4+ digits" type="password" {...f("pin")} />
            <FieldSelect label="Role" {...f("role")}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </FieldSelect>
          </FormRow>
        </FormGrid>
      </Drawer>

      <ConfirmModal
        open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && removeMutation.mutate(deleteTarget.id)}
        title="Delete user"
        description={`Permanently delete "${deleteTarget?.name}"? Their sessions will be revoked.`}
        confirmLabel="Delete User" danger loading={removeMutation.isPending}
      />
    </div>
  );
}

/* ── User card ── */
function UserCard({ row, onDelete }: { row: Row; onDelete?: () => void }) {
  const color = ringColor(row.name);
  const init  = initials(row.name);

  return (
    <div className="user-card">
      {/* Avatar with colored ring */}
      <div className="user-card-avatar" style={{ background: color }}>
        <div className="user-card-ring" style={{ borderColor: `${color}55` }} />
        {init}
      </div>

      <p style={{ fontSize: "0.9375rem", fontWeight: 650, color: "var(--fg)", letterSpacing: "-0.02em", lineHeight: 1.2 }}>{row.name}</p>
      <RoleBadge role={row.role} />
      <p style={{ fontSize: "0.775rem", color: "var(--fg-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", width: "100%", fontFamily: "ui-monospace, monospace" }}>{row.email}</p>

      <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: row.isActive ? "#22c55e" : "var(--fg-subtle)", flexShrink: 0 }} />
        <span style={{ fontSize: "0.75rem", color: "var(--fg-subtle)" }}>{row.isActive ? "Active" : "Inactive"}</span>
        <span style={{ margin: "0 2px", color: "var(--border-strong)" }}>·</span>
        <TimeAgo date={row.createdAt} />
      </div>

      {onDelete ? (
        <button
          onClick={onDelete}
          style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 12px", borderRadius: "var(--radius-pill)", border: "1px solid rgba(185,28,28,0.2)", background: "transparent", color: "#b91c1c", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", transition: "background var(--dur-fast) var(--ease-out)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
          Delete
        </button>
      ) : (
        <span style={{ marginTop: 12, fontSize: "0.7rem", color: "var(--fg-subtle)", fontStyle: "italic" }}>Protected</span>
      )}
    </div>
  );
}
