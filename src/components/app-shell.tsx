"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useRef, useState, useTransition } from "react";

/* ============================================================
   TYPES + NAV STRUCTURE
   ============================================================ */
type NavItem = { label: string; href: string; icon: ReactNode };

const NAV_SECTIONS: { items: NavItem[] }[] = [
  {
    items: [
      { label: "Dashboard",         href: "/dashboard",   icon: <IcoDashboard /> },
    ],
  },
  {
    items: [
      { label: "Clients",           href: "/clients",     icon: <IcoClients /> },
      { label: "Files",             href: "/files",       icon: <IcoFiles /> },
      { label: "Credentials",       href: "/credentials", icon: <IcoCredentials /> },
    ],
  },
  {
    items: [
      { label: "Users",             href: "/users",       icon: <IcoUsers /> },
      { label: "Backup & Recovery", href: "/backups",     icon: <IcoBackup /> },
      { label: "Audit Log",         href: "/audit",       icon: <IcoAudit /> },
    ],
  },
];

const ALL_ROUTES: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/* ============================================================
   APP SHELL
   ============================================================ */
export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  const [cmdOpen, setCmdOpen] = useState(false);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
      if (e.key === "Escape") setCmdOpen(false);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="app-container">
      <Sidebar userName={userName} onOpenCmd={() => setCmdOpen(true)} />
      <div className="main-content">
        <div className="page-content">{children}</div>
      </div>
      {cmdOpen && <CommandPalette onClose={() => setCmdOpen(false)} />}
    </div>
  );
}

/* ============================================================
   SIDEBAR
   ============================================================ */
function Sidebar({ userName, onOpenCmd }: { userName: string; onOpenCmd: () => void }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [pending, start] = useTransition();

  const initials = userName
    .split(" ").slice(0, 2)
    .map((n) => n[0]).join("").toUpperCase();

  async function handleLogout() {
    start(async () => {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    });
  }

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="1" y="1" width="6" height="6" rx="1.5" fill="rgba(255,255,255,0.9)" />
            <rect x="9" y="1" width="6" height="6" rx="1.5" fill="rgba(255,255,255,0.5)" />
            <rect x="1" y="9" width="6" height="6" rx="1.5" fill="rgba(255,255,255,0.5)" />
            <rect x="9" y="9" width="6" height="6" rx="1.5" fill="rgba(255,255,255,0.7)" />
          </svg>
        </div>
        <span className="sidebar-wordmark">KusHQ</span>
      </div>

      {/* Search shortcut */}
      <button className="sidebar-search-btn" onClick={onOpenCmd}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <span style={{ flex: 1, textAlign: "left" }}>Search…</span>
        <kbd style={{ fontSize: "0.62rem", padding: "1px 5px", borderRadius: "4px", background: "var(--bg-subtle)", color: "var(--fg-subtle)", fontFamily: "ui-monospace, monospace", border: "1px solid var(--border-strong)" }}>
          ⌘K
        </kbd>
      </button>

      {/* Nav */}
      <nav className="nav-menu">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {si > 0 && <div className="nav-divider" />}
            {section.items.map(({ label, href, icon }) => {
              const active = pathname === href;
              return (
                <Link key={href} href={href} className={`nav-item${active ? " active" : ""}`}>
                  <span className="nav-item-icon">{icon}</span>
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="user-profile">
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <span className="user-name">{userName}</span>
          <button
            onClick={handleLogout}
            disabled={pending}
            title="Sign out"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, borderRadius: "var(--radius-md)",
              border: "none", background: "transparent",
              color: "var(--fg-subtle)", cursor: "pointer", flexShrink: 0,
              transition: "color var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--fg)"; e.currentTarget.style.background = "var(--bg-subtle)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--fg-subtle)"; e.currentTarget.style.background = "transparent"; }}
          >
            {pending
              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "spin 0.7s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
            }
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ============================================================
   COMMAND PALETTE
   ============================================================ */
function CommandPalette({ onClose }: { onClose: () => void }) {
  const router   = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const filtered = ALL_ROUTES.filter(
    (r) => !query.trim() || r.label.toLowerCase().includes(query.toLowerCase()),
  );

  function navigate(href: string) { onClose(); router.push(href); }

  return (
    <>
      <div className="cmdk-backdrop" onClick={onClose} />
      <div className="cmdk-panel" role="dialog" aria-modal="true" aria-label="Command palette">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pages, actions…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.9rem", color: "var(--fg)" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && filtered.length > 0) navigate(filtered[0].href);
            }}
          />
          <kbd style={{ fontSize: "0.65rem", padding: "2px 7px", borderRadius: "5px", border: "1px solid var(--border-strong)", color: "var(--fg-subtle)", fontFamily: "ui-monospace, monospace", background: "var(--bg-subtle)" }}>ESC</kbd>
        </div>

        <div style={{ padding: "6px", maxHeight: "340px", overflowY: "auto" }}>
          {!query && (
            <p style={{ padding: "5px 12px 4px", fontSize: "0.68rem", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>Navigate</p>
          )}
          {filtered.length === 0 && (
            <p style={{ padding: "24px 12px", fontSize: "0.8rem", color: "var(--fg-subtle)", textAlign: "center" }}>No results for &ldquo;{query}&rdquo;</p>
          )}
          {filtered.map((r) => (
            <button
              key={r.href}
              onClick={() => navigate(r.href)}
              style={{
                display: "flex", alignItems: "center", gap: "11px", width: "100%",
                padding: "10px 12px", borderRadius: "var(--radius-lg)", border: "none",
                background: "transparent", cursor: "pointer", textAlign: "left",
                transition: "background var(--dur-fast) var(--ease-out)", color: "var(--fg)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-subtle)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--fg-subtle)", display: "flex", flexShrink: 0 }}>{r.icon}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 500 }}>{r.label}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--fg-subtle)", fontFamily: "ui-monospace, monospace" }}>{r.href}</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: "14px", padding: "9px 16px", borderTop: "1px solid var(--border)" }}>
          {[["↑↓", "navigate"], ["↵", "open"], ["esc", "close"]].map(([k, l]) => (
            <span key={k} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <kbd style={{ fontSize: "0.62rem", padding: "1px 5px", borderRadius: "4px", border: "1px solid var(--border-strong)", color: "var(--fg-subtle)", fontFamily: "ui-monospace, monospace", background: "var(--bg-subtle)" }}>{k}</kbd>
              <span style={{ fontSize: "0.7rem", color: "var(--fg-subtle)" }}>{l}</span>
            </span>
          ))}
        </div>
      </div>
    </>
  );
}

/* ============================================================
   ICONS  (14×14, 1.8 stroke)
   ============================================================ */
function IcoDashboard() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.2" /><rect x="14" y="3" width="7" height="7" rx="1.2" /><rect x="3" y="14" width="7" height="7" rx="1.2" /><rect x="14" y="14" width="7" height="7" rx="1.2" /></svg>;
}
function IcoClients() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
}
function IcoFiles() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>;
}
function IcoCredentials() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
}
function IcoUsers() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
}
function IcoBackup() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>;
}
function IcoAudit() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>;
}
