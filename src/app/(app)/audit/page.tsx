"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, Pagination, SkeletonText } from "@/components/ui";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { apiGet } from "@/lib/api-client";

type Row = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorName: string | null;
  ipAddress: string | null;
  createdAt: string;
};

/* action family → color + label */
type Family = "create" | "delete" | "login" | "reveal" | "update" | "other";

function classify(action: string): Family {
  if (/delete/i.test(action)) return "delete";
  if (/create|upload/i.test(action)) return "create";
  if (/login|logout/i.test(action)) return "login";
  if (/reveal/i.test(action)) return "reveal";
  if (/update|edit/i.test(action)) return "update";
  return "other";
}

const FAMILY_META: Record<Family, { dot: string; pill: string; text: string; label: string }> = {
  create:  { dot: "#22c55e", pill: "#ecfdf5", text: "#15803d", label: "Create" },
  delete:  { dot: "#ef4444", pill: "#fef2f2", text: "#b91c1c", label: "Delete" },
  login:   { dot: "#3b82f6", pill: "#eff6ff", text: "#1d4ed8", label: "Auth"   },
  reveal:  { dot: "#f59e0b", pill: "#fffbeb", text: "#b45309", label: "Reveal" },
  update:  { dot: "#8b5cf6", pill: "#f5f3ff", text: "#6d28d9", label: "Update" },
  other:   { dot: "var(--fg-subtle)", pill: "var(--bg-subtle)", text: "var(--fg-muted)", label: "Other" },
};

const FAMILIES: Family[] = ["create", "delete", "login", "reveal", "update", "other"];

/* group rows by calendar date */
function groupByDay(rows: Row[]): Map<string, Row[]> {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const day = new Date(row.createdAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(row);
  }
  return map;
}

function ActorChip({ name }: { name: string | null }) {
  const label = name ?? "System";
  const init  = label.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      height: 22, paddingLeft: 3, paddingRight: 8,
      borderRadius: "var(--radius-pill)",
      background: "var(--bg-subtle)",
      border: "1px solid var(--border)",
      fontSize: "0.72rem", color: "var(--fg-muted)", fontWeight: 500,
      whiteSpace: "nowrap", flexShrink: 0,
    }}>
      <span style={{ width: 16, height: 16, borderRadius: "50%", background: "var(--fg)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem", fontWeight: 700, flexShrink: 0 }}>{init}</span>
      {label}
    </span>
  );
}

export default function AuditPage() {
  const [search, setSearch]           = useState("");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<20 | 50 | 100 | "all">(20);
  const [activeFamily, setActiveFamily] = useState<Family | "all">("all");
  const debounced = useDebouncedValue(search, 250);

  const key = useMemo(
    () => ["audit", debounced, page, pageSize],
    [debounced, page, pageSize],
  );

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      apiGet<{ items: Row[]; total: number; offset: number }>(
        `/api/audit?search=${encodeURIComponent(debounced)}&page=${page}&pageSize=${pageSize}`,
      ),
    placeholderData: (p) => p,
  });

  const allRows = query.data?.items ?? [];
  const rows    = activeFamily === "all" ? allRows : allRows.filter((r) => classify(r.action) === activeFamily);
  const grouped = groupByDay(rows);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Security</span>
          <h1 className="page-title">Audit Log</h1>
          <p className="page-subtitle">A complete security and operational trail of all critical actions.</p>
        </div>
        {query.data && (
          <div className="page-actions">
            <span style={{ fontSize: "0.8rem", color: "var(--fg-subtle)" }}>
              {query.data.total.toLocaleString()} event{query.data.total !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="filter-bar">
        <div className="search-input-wrap">
          <svg className="search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search actions, actors, entities…" className="filter-input" style={{ paddingLeft: 34, width: 280 }} />
        </div>
        {/* Family filter chips */}
        <button
          className={`filter-chip${activeFamily === "all" ? " active" : ""}`}
          onClick={() => setActiveFamily("all")}
        >
          All
        </button>
        {FAMILIES.map((fam) => (
          <button
            key={fam}
            className={`filter-chip${activeFamily === fam ? " active" : ""}`}
            onClick={() => setActiveFamily(fam)}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: FAMILY_META[fam].dot, flexShrink: 0 }} />
            {FAMILY_META[fam].label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {query.isLoading && !query.data && (
        <div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="feed-card" style={{ borderBottom: "1px solid var(--border)" }}>
              <div className="feed-dot skeleton" style={{ marginTop: 5 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <SkeletonText width="45%" />
                <SkeletonText width="30%" height={11} />
              </div>
              <SkeletonText width="48px" height={11} />
            </div>
          ))}
        </div>
      )}

      {!query.isLoading && rows.length === 0 && (
        <EmptyState
          title="No audit events"
          description="Activity will appear here as users interact with the system."
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
        />
      )}

      {rows.length > 0 && Array.from(grouped.entries()).map(([day, dayRows]) => (
        <div key={day} style={{ marginBottom: 16 }}>
          {/* Day header */}
          <p className="day-header" style={{ borderRadius: "var(--radius-sm)", background: "var(--bg)" }}>{day}</p>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-xs)" }}>
            {dayRows.map((row, i) => {
              const fam  = classify(row.action);
              const meta = FAMILY_META[fam];
              return (
                <div
                  key={row.id}
                  className="feed-card"
                  style={{
                    borderBottom: i < dayRows.length - 1 ? "1px solid var(--border)" : "none",
                    gap: 12, alignItems: "center",
                  }}
                >
                  {/* Dot */}
                  <span
                    className="feed-dot"
                    style={{ background: meta.dot, marginTop: 0, boxShadow: `0 0 0 3px ${meta.dot}22`, flexShrink: 0 }}
                  />

                  {/* Action pill */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "3px 9px", borderRadius: "var(--radius-pill)",
                    background: meta.pill, fontSize: "0.72rem", fontWeight: 600,
                    color: meta.text, whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    {row.action}
                  </span>

                  {/* Entity */}
                  <span style={{
                    fontFamily: "ui-monospace, monospace", fontSize: "0.7rem",
                    color: "var(--fg-subtle)", overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", flex: 1, minWidth: 0,
                  }}
                    title={`${row.entityType}${row.entityId ? `:${row.entityId}` : ""}`}
                  >
                    {row.entityType}
                    {row.entityId && <span style={{ opacity: 0.6 }}>:{row.entityId.slice(0, 8)}…</span>}
                  </span>

                  {/* Actor chip */}
                  <ActorChip name={row.actorName} />

                  {/* IP */}
                  {row.ipAddress && (
                    <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem", color: "var(--fg-subtle)", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {row.ipAddress}
                    </span>
                  )}

                  {/* Time */}
                  <span style={{ fontSize: "0.72rem", color: "var(--fg-subtle)", whiteSpace: "nowrap", flexShrink: 0 }} title={new Date(row.createdAt).toLocaleString()}>
                    {new Date(row.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {query.data && query.data.total > 0 && (
        <div style={{ marginTop: 8 }}>
          <Pagination page={page} total={query.data.total} pageSize={pageSize} onPage={setPage} onPageSize={(s) => { setPageSize(s); setPage(1); }} />
        </div>
      )}
    </div>
  );
}
