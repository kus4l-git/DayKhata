"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SkeletonText, StatTile, TimeAgo } from "@/components/ui";
import { apiGet } from "@/lib/api-client";

type DashboardPayload = {
  stats: { clients: number; files: number; credentials: number; users: number };
  recentAudit: Array<{
    id: string;
    action: string;
    entityType: string;
    actorName?: string | null;
    createdAt: string;
  }>;
  recentBackups: Array<{
    id: string;
    status: string;
    startedAt: string;
    finishedAt?: string | null;
    details?: { message?: string } | null;
  }>;
};

const Icons = {
  clients: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  files: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  credentials: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  arrowRight: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  ),
};

function auditDotColor(action: string): string {
  if (/delete/i.test(action)) return "#ef4444";
  if (/create|upload/i.test(action)) return "#22c55e";
  if (/login/i.test(action)) return "#3b82f6";
  if (/reveal/i.test(action)) return "#f59e0b";
  if (/update/i.test(action)) return "#8b5cf6";
  return "var(--fg-subtle)";
}

function backupStatusColor(status: string): string {
  if (status === "SUCCESS") return "#22c55e";
  if (status === "FAILED") return "#ef4444";
  return "#f59e0b";
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiGet<DashboardPayload>("/api/dashboard"),
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Hero banner ── */}
      <div className="hero-banner">
        <div style={{ position: "relative", zIndex: 1 }}>
          <p className="hero-kicker">Day Khata System Management</p>
          <h1 className="hero-title">{greeting}</h1>
          <p className="hero-sub">Here&rsquo;s what&rsquo;s happening with your system today.</p>
        </div>
        {/* Decorative circles */}
        <div style={{ position: "absolute", right: "-40px", top: "-60px", width: 280, height: 280, borderRadius: "50%", background: "rgba(255,255,255,0.03)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: "60px", bottom: "-80px", width: 180, height: 180, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "auto" }}>

        </div>
      </div>

      {/* ── Stat tiles ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px" }}>
        <StatTile
          label="Total Clients" color="blue"
          value={isLoading ? "—" : (data?.stats.clients ?? 0)}
          href="/clients" icon={Icons.clients}
        />
        <StatTile
          label="Total Files" color="green"
          value={isLoading ? "—" : (data?.stats.files ?? 0)}
          href="/files" icon={Icons.files}
        />
        <StatTile
          label="Credentials" color="orange"
          value={isLoading ? "—" : (data?.stats.credentials ?? 0)}
          href="/credentials" icon={Icons.credentials}
        />
        <StatTile
          label="Users" color="purple"
          value={isLoading ? "—" : (data?.stats.users ?? 0)}
          href="/users" icon={Icons.users}
        />
      </div>

      {/* ── Two-column lower section ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", alignItems: "start" }}>

        {/* Recent Activity */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            boxShadow: "var(--shadow-xs)",
          }}
        >
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border)",
          }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 650, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
              Recent Activity
            </p>
            <Link href="/audit" style={{
              display: "inline-flex", alignItems: "center", gap: "4px",
              fontSize: "0.775rem", color: "var(--fg-muted)",
              textDecoration: "underline", textDecorationColor: "var(--border-strong)",
              textUnderlineOffset: "2px",
            }}>
              View all {Icons.arrowRight}
            </Link>
          </div>

          <div>
            {isLoading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="feed-card">
                <div className="feed-dot skeleton" style={{ marginTop: 5 }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
                  <SkeletonText width="55%" />
                  <SkeletonText width="35%" height={11} />
                </div>
                <SkeletonText width="52px" height={11} />
              </div>
            ))}

            {data?.recentAudit.length === 0 && (
              <p style={{ padding: "32px 20px", fontSize: "0.8rem", color: "var(--fg-subtle)", textAlign: "center" }}>
                No activity recorded yet.
              </p>
            )}

            {data?.recentAudit.map((a, i) => (
              <div
                key={a.id}
                className="feed-card"
                style={{ borderBottom: i < (data.recentAudit.length - 1) ? "1px solid var(--border)" : "none" }}
              >
                <span
                  className="feed-dot"
                  style={{ background: auditDotColor(a.action), marginTop: 5, boxShadow: `0 0 0 3px ${auditDotColor(a.action)}22` }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "0.8125rem", fontWeight: 550, color: "var(--fg)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {a.action}
                  </p>
                  {(a.actorName || a.entityType) && (
                    <p style={{ fontSize: "0.75rem", color: "var(--fg-subtle)", marginTop: "1px" }}>
                      {a.actorName && <span>{a.actorName}</span>}
                      {a.actorName && a.entityType && <span style={{ margin: "0 4px" }}>·</span>}
                      {a.entityType && (
                        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.7rem" }}>
                          {a.entityType}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <TimeAgo date={a.createdAt} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Quick Actions */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-xs)",
          }}>
            <p style={{
              padding: "14px 18px 10px",
              fontSize: "0.7rem", fontWeight: 650, letterSpacing: "0.07em", textTransform: "uppercase",
              color: "var(--fg-subtle)", borderBottom: "1px solid var(--border)",
            }}>
              Quick Actions
            </p>
            <div style={{ padding: "8px" }}>
              {[
                { href: "/files",       label: "Upload Files",      sub: "Single or bulk upload",         icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></svg> },
                { href: "/clients",     label: "Add Client",        sub: "Create a new client record",    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg> },
                { href: "/credentials", label: "New Credential",    sub: "Securely store a secret",       icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg> },
                { href: "/backups",     label: "Backup Now",        sub: "Create a system snapshot",      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg> },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 10px", borderRadius: "var(--radius-lg)",
                    textDecoration: "none",
                    transition: "background var(--dur-fast) var(--ease-out)",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-subtle)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.background = "transparent")}
                >
                  <span style={{
                    width: 30, height: 30, borderRadius: "var(--radius-md)",
                    background: "var(--bg-subtle)", border: "1px solid var(--border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "var(--fg-muted)", flexShrink: 0,
                    boxShadow: "var(--shadow-inner)",
                  }}>
                    {action.icon}
                  </span>
                  <div>
                    <p style={{ fontSize: "0.8125rem", fontWeight: 550, color: "var(--fg)", lineHeight: 1.3 }}>{action.label}</p>
                    <p style={{ fontSize: "0.725rem", color: "var(--fg-subtle)" }}>{action.sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Backup status */}
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)", overflow: "hidden", boxShadow: "var(--shadow-xs)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 18px 10px", borderBottom: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "0.7rem", fontWeight: 650, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>
                Backups
              </p>
              <Link href="/backups" style={{ fontSize: "0.75rem", color: "var(--fg-muted)", textDecoration: "underline", textDecorationColor: "var(--border-strong)", textUnderlineOffset: "2px" }}>
                Manage
              </Link>
            </div>
            <div style={{ padding: "8px" }}>
              {isLoading && Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ padding: "9px 10px" }}><SkeletonText width="80%" /></div>
              ))}
              {!isLoading && !data?.recentBackups.length && (
                <p style={{ padding: "16px", fontSize: "0.775rem", color: "var(--fg-subtle)", textAlign: "center" }}>No backups yet.</p>
              )}
              {data?.recentBackups.map((b) => (
                <div key={b.id} style={{
                  display: "flex", alignItems: "center", gap: "9px",
                  padding: "9px 10px", borderRadius: "var(--radius-md)",
                  transition: "background var(--dur-fast) var(--ease-out)",
                }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--bg-subtle)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: backupStatusColor(b.status), flexShrink: 0,
                    boxShadow: `0 0 0 3px ${backupStatusColor(b.status)}22`,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.8rem", fontWeight: 550, color: "var(--fg)" }}>{b.status}</p>
                    {b.details?.message && (
                      <p style={{ fontSize: "0.725rem", color: "var(--fg-subtle)", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {b.details.message}
                      </p>
                    )}
                  </div>
                  <TimeAgo date={b.startedAt} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 1024px) {
          .dash-two-col { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .dash-stats { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
