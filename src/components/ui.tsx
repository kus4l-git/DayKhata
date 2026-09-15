"use client";

import {
  ButtonHTMLAttributes,
  createContext,
  forwardRef,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

/* ============================================================
   PAGE WRAPPER
   ============================================================ */
export function Page({
  kicker, title, subtitle, actions, children,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <div className="page-header">
        <div className="page-header-left">
          {kicker && <span className="page-kicker">{kicker}</span>}
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/* ============================================================
   BUTTON
   ============================================================ */
type BtnVariant = "primary" | "ghost" | "danger";
type BtnSize    = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: BtnSize;
  loading?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "ghost", size = "md", loading, icon, className, ...props }, ref) => {
    const cls = [
      `btn-${variant}`,
      size === "sm" ? "btn-sm" : "",
      className ?? "",
    ].filter(Boolean).join(" ");

    return (
      <button ref={ref} {...props} disabled={props.disabled || loading} className={cls}>
        {loading && <Spinner size={13} />}
        {!loading && icon && <span style={{ display: "flex", flexShrink: 0 }}>{icon}</span>}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

/* ============================================================
   INPUT
   ============================================================ */
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  fieldClass?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ prefix, suffix, fieldClass, style, ...props }, ref) => {
    if (prefix || suffix) {
      return (
        <div
          className={fieldClass ?? "field-input"}
          style={{ display: "flex", alignItems: "center", gap: 0, padding: 0, height: "34px" }}
          onFocusCapture={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
          onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--border-strong)")}
        >
          {prefix && <span style={{ paddingLeft: "11px", color: "var(--fg-subtle)", flexShrink: 0, display: "flex" }}>{prefix}</span>}
          <input
            ref={ref}
            {...props}
            style={{ flex: 1, height: "100%", background: "transparent", border: "none", outline: "none", padding: "0 11px", fontSize: "0.8125rem", color: "var(--fg)", ...style }}
          />
          {suffix && <span style={{ paddingRight: "11px", color: "var(--fg-subtle)", flexShrink: 0, display: "flex" }}>{suffix}</span>}
        </div>
      );
    }
    return (
      <input
        ref={ref}
        {...props}
        className={fieldClass ?? "field-input"}
        style={style}
        onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; props.onFocus?.(e); }}
        onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; props.onBlur?.(e); }}
      />
    );
  },
);
Input.displayName = "Input";

/* ============================================================
   TEXTAREA
   ============================================================ */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  (props, ref) => (
    <textarea
      ref={ref}
      {...props}
      className="field-textarea"
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; props.onBlur?.(e); }}
    />
  ),
);
Textarea.displayName = "Textarea";

/* ============================================================
   SELECT
   ============================================================ */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      {...props}
      className={className ?? "field-select"}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--border-focus)"; props.onFocus?.(e); }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border-strong)"; props.onBlur?.(e); }}
    />
  ),
);
Select.displayName = "Select";

/* ============================================================
   SPINNER
   ============================================================ */
export function Spinner({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="2.5" strokeLinecap="round"
      style={{ animation: "spin 0.7s linear infinite", flexShrink: 0 }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

/* ============================================================
   SKELETON
   ============================================================ */
export function SkeletonRows({ rows = 6, height = 38 }: { rows?: number; height?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "7px", padding: "6px 0" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export function SkeletonText({ width = "60%", height = 13 }: { width?: string | number; height?: number }) {
  return <div className="skeleton" style={{ width, height, borderRadius: "var(--radius-xs)" }} />;
}

export function SkeletonCard({ height = 240 }: { height?: number }) {
  return <div className="skeleton" style={{ height, borderRadius: "var(--radius-2xl)", width: "100%" }} />;
}

/* ============================================================
   EMPTY STATE
   ============================================================ */
export function EmptyState({
  title, description, action, icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-icon-chip">{icon}</div>}
      <p className="empty-title">{title}</p>
      {description && <p className="empty-body">{description}</p>}
      {action && <div style={{ marginTop: "10px" }}>{action}</div>}
    </div>
  );
}

/* ============================================================
   PAGINATION
   ============================================================ */
type PageSize = 20 | 50 | 100 | "all";

export function Pagination({
  page, total, pageSize, onPage, onPageSize,
}: {
  page: number;
  total: number;
  pageSize: PageSize;
  onPage: (p: number) => void;
  onPageSize: (p: PageSize) => void;
}) {
  const pages  = pageSize === "all" ? 1 : Math.max(1, Math.ceil(total / (pageSize as number)));
  const prev   = page > 1;
  const next   = page < pages;
  const offset = pageSize === "all" ? 0 : (page - 1) * (pageSize as number);
  const end    = pageSize === "all" ? total : Math.min(offset + (pageSize as number), total);

  const nums = (): (number | "…")[] => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const around = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
    const sorted = Array.from(around).sort((a, b) => a - b);
    const result: (number | "…")[] = [];
    let last = 0;
    for (const n of sorted) {
      if (n - last > 1) result.push("…");
      result.push(n);
      last = n;
    }
    return result;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "14px", gap: "12px", flexWrap: "wrap" }}>
      <p style={{ fontSize: "0.75rem", color: "var(--fg-subtle)", whiteSpace: "nowrap" }}>
        {total === 0 ? "No results" : `${offset + 1}–${end} of ${total}`}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <PageBtn onClick={() => onPage(page - 1)} disabled={!prev}>‹</PageBtn>
          {nums().map((n, i) =>
            n === "…"
              ? <span key={`e${i}`} style={{ width: 28, textAlign: "center", fontSize: "0.775rem", color: "var(--fg-subtle)" }}>…</span>
              : <PageBtn key={n} onClick={() => onPage(n as number)} active={n === page}>{n}</PageBtn>
          )}
          <PageBtn onClick={() => onPage(page + 1)} disabled={!next}>›</PageBtn>
        </div>
        <select
          value={String(pageSize)}
          onChange={(e) => onPageSize(e.target.value as PageSize)}
          className="filter-select"
          style={{ width: "110px", fontSize: "0.775rem" }}
        >
          <option value="20">20 / page</option>
          <option value="50">50 / page</option>
          <option value="100">100 / page</option>
          <option value="all">All</option>
        </select>
      </div>
    </div>
  );
}

function PageBtn({ children, onClick, disabled, active }: {
  children: ReactNode; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        borderRadius: "var(--radius-sm)",
        fontSize: "0.775rem", fontWeight: active ? 650 : 400,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.35 : 1,
        border: active ? "1px solid var(--border-strong)" : "1px solid transparent",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-muted)",
        boxShadow: active ? "var(--shadow-xs)" : "none",
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
      }}
      onMouseEnter={(e) => { if (!disabled && !active) { e.currentTarget.style.background = "var(--bg-subtle)"; e.currentTarget.style.color = "var(--fg)"; } }}
      onMouseLeave={(e) => { if (!disabled && !active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-muted)"; } }}
    >
      {children}
    </button>
  );
}

/* ============================================================
   VIEW SWITCHER
   ============================================================ */
export function ViewSwitcher({
  view, onChange, options,
}: {
  view: string;
  onChange: (v: string) => void;
  options: { value: string; icon: ReactNode; label: string }[];
}) {
  return (
    <div style={{
      display: "inline-flex",
      background: "var(--surface)",
      border: "1px solid var(--border-strong)",
      borderRadius: "var(--radius-lg)",
      padding: "3px",
      gap: "2px",
      boxShadow: "var(--shadow-xs)",
    }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          title={opt.label}
          onClick={() => onChange(opt.value)}
          style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 30, height: 28,
            borderRadius: "var(--radius-md)",
            border: "none", cursor: "pointer",
            transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)",
            background: view === opt.value ? "var(--bg-subtle)" : "transparent",
            color: view === opt.value ? "var(--fg)" : "var(--fg-subtle)",
            boxShadow: view === opt.value ? "var(--shadow-xs)" : "none",
          }}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}

/* ============================================================
   CHECKBOX
   ============================================================ */
export function Checkbox({ checked, onChange, indeterminate }: {
  checked: boolean; onChange: (c: boolean) => void; indeterminate?: boolean;
}) {
  return (
    <label style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", userSelect: "none" }}>
      <span style={{
        width: 15, height: 15,
        borderRadius: "var(--radius-xs)",
        border: checked || indeterminate ? "none" : "1.5px solid var(--border-strong)",
        background: checked || indeterminate ? "var(--accent)" : "var(--surface)",
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        transition: "background var(--dur-fast), border var(--dur-fast)",
      }}>
        {checked && <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
        {indeterminate && !checked && <svg width="8" height="2" viewBox="0 0 8 2" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><line x1="0" y1="1" x2="8" y2="1" /></svg>}
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ position: "absolute", opacity: 0, width: 0, height: 0 }} />
      </span>
    </label>
  );
}

/* ============================================================
   STAT TILE
   ============================================================ */
type TileColor = "blue" | "green" | "orange" | "purple";

export function StatTile({
  label, value, icon, color = "blue", href, trend,
}: {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: TileColor;
  href?: string;
  trend?: string;
}) {
  const inner = (
    <div className={`stat-tile stat-tile--${color}`}>
      <div className="stat-tile-header">
        <span className="stat-tile-label">{label}</span>
        {icon && <div className="stat-tile-icon-chip" style={{ color: tileIconColor(color) }}>{icon}</div>}
      </div>
      <p className="stat-tile-value">{value}</p>
      {trend && <p className="stat-tile-trend">{trend}</p>}
    </div>
  );
  return href
    ? <a href={href} style={{ display: "block", textDecoration: "none" }}>{inner}</a>
    : inner;
}

function tileIconColor(c: TileColor) {
  return c === "blue" ? "#2563eb" : c === "green" ? "#16a34a" : c === "orange" ? "#ea580c" : "#7c3aed";
}

/* ============================================================
   BADGE
   ============================================================ */
type BadgeVariant = "green" | "red" | "yellow" | "blue" | "neutral" | "purple" | "dark";

export function Badge({ children, variant = "neutral" }: { children: ReactNode; variant?: BadgeVariant }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function DelegatedBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = {
    LAST_ACTIVE: "green", WIP: "yellow", INACTIVE: "red", UNASSIGNED: "neutral", CUSTOM: "blue",
  };
  const labels: Record<string, string> = {
    LAST_ACTIVE: "Last Active", WIP: "In Progress", INACTIVE: "Inactive", UNASSIGNED: "Unassigned", CUSTOM: "Custom",
  };
  return <Badge variant={map[status] ?? "neutral"}>{labels[status] ?? status}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, BadgeVariant> = { SUPER_ADMIN: "purple", ADMIN: "blue", STAFF: "neutral" };
  const labels: Record<string, string> = { SUPER_ADMIN: "Super Admin", ADMIN: "Admin", STAFF: "Staff" };
  return <Badge variant={map[role] ?? "neutral"}>{labels[role] ?? role}</Badge>;
}

export function BackupBadge({ status }: { status: string }) {
  const map: Record<string, BadgeVariant> = { SUCCESS: "green", FAILED: "red", RUNNING: "yellow" };
  return <Badge variant={map[status] ?? "neutral"}>{status}</Badge>;
}

/* ============================================================
   BULK BAR
   ============================================================ */
export function BulkBar({ count, onClear, children }: {
  count: number; onClear: () => void; children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="bulk-bar">
      <span style={{ marginRight: "4px" }}>{count} selected</span>
      <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.2)", flexShrink: 0 }} />
      {children}
      <button
        onClick={onClear}
        className="bulk-btn"
        style={{ marginLeft: "auto" }}
      >
        Clear
      </button>
    </div>
  );
}

export function BulkButton({ children, onClick, icon }: {
  children: ReactNode; onClick: () => void; icon?: ReactNode;
}) {
  return (
    <button className="bulk-btn" onClick={onClick}>
      {icon && <span style={{ display: "flex" }}>{icon}</span>}
      {children}
    </button>
  );
}

/* ============================================================
   PROGRESS BAR
   ============================================================ */
export function ProgressBar({ value, animated }: { value: number; animated?: boolean }) {
  return (
    <div style={{ height: "3px", borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,0.15)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${Math.min(100, value)}%`,
        background: "#fff", borderRadius: "var(--radius-pill)",
        transition: "width 200ms var(--ease-out)",
        animation: animated ? "progress-pulse 1.5s ease infinite" : undefined,
      }} />
    </div>
  );
}

/* ============================================================
   FILE TYPE ICON
   ============================================================ */
export function FileTypeIcon({ mimeType, extension, size = 32 }: {
  mimeType: string; extension?: string | null; size?: number;
}) {
  const ext  = (extension ?? "").toLowerCase();
  const mime = mimeType.toLowerCase();
  let bg = "#f5f5f4", fg = "#78716c", label = ext.slice(0, 4).toUpperCase() || "FILE";

  if (mime.startsWith("image/"))                                   { bg = "#dcf5e4"; fg = "#15803d"; label = "IMG"; }
  else if (mime === "application/pdf")                             { bg = "#fecaca"; fg = "#b91c1c"; label = "PDF"; }
  else if (mime.includes("spreadsheet") || ext === "xlsx" || ext === "csv") { bg = "#d1fae5"; fg = "#065f46"; label = ext.toUpperCase() || "XLS"; }
  else if (mime.includes("word") || ext === "doc" || ext === "docx")        { bg = "#dbeafe"; fg = "#1e40af"; label = ext.toUpperCase() || "DOC"; }
  else if (mime.includes("presentation") || ext === "pptx")                 { bg = "#fed7aa"; fg = "#9a3412"; label = ext.toUpperCase() || "PPT"; }
  else if (mime.includes("zip") || mime.includes("compressed"))             { bg = "#ede9fe"; fg = "#5b21b6"; label = "ZIP"; }
  else if (mime.startsWith("video/"))                              { bg = "#fce7f3"; fg = "#831843"; label = "VID"; }
  else if (mime.startsWith("audio/"))                              { bg = "#fed7aa"; fg = "#9a3412"; label = "AUD"; }
  else if (mime.startsWith("text/"))                               { bg = "#f1f5f9"; fg = "#475569"; label = "TXT"; }

  return (
    <div style={{
      width: size, height: size,
      borderRadius: "var(--radius-sm)",
      background: bg,
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
    }}>
      <span style={{ fontSize: size * 0.26, fontWeight: 700, color: fg, letterSpacing: "-0.02em" }}>{label}</span>
    </div>
  );
}

/* ============================================================
   UTILITIES
   ============================================================ */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const s = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

export function TimeAgo({ date }: { date: string | Date }) {
  const d    = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const s    = Math.floor(diff / 1000);
  const m    = Math.floor(s / 60);
  const h    = Math.floor(m / 60);
  const days = Math.floor(h / 24);
  const text = s < 60 ? "just now" : m < 60 ? `${m}m ago` : h < 24 ? `${h}h ago` : days < 7 ? `${days}d ago` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return <span title={d.toLocaleString()} style={{ color: "var(--fg-subtle)", fontSize: "0.75rem", cursor: "default", whiteSpace: "nowrap" }}>{text}</span>;
}

export function IpLink({ ip }: { ip: string | null }) {
  if (!ip) return <span style={{ color: "var(--fg-subtle)" }}>—</span>;
  return (
    <a href={`http://${ip}`} target="_blank" rel="noreferrer"
      style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.775rem", color: "var(--fg)", textDecoration: "underline", textDecorationColor: "var(--border-strong)", textUnderlineOffset: "2px" }}
      onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = "var(--fg)")}
      onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = "var(--border-strong)")}
    >
      {ip}
    </a>
  );
}

export function Mono({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontFamily: 'ui-monospace,"SF Mono",Menlo,Consolas,monospace', fontSize: "0.775rem", color: "var(--fg)", letterSpacing: "0.02em", ...style }}>
      {children}
    </span>
  );
}

/* ============================================================
   CLIENT COVER GRADIENT  (deterministic from name)
   ============================================================ */
const COVER_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
  "linear-gradient(135deg, #fd7043 0%, #ff8a65 100%)",
  "linear-gradient(135deg, #26a69a 0%, #80cbc4 100%)",
];

export function clientGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

/* ============================================================
   TOAST CONTEXT + PROVIDER
   ============================================================ */
type ToastType = "success" | "error" | "info";
type ToastEntry = { id: string; message: string; type: ToastType };
type ToastCtx   = { toast: (message: string, type?: ToastType) => void };

const ToastContext = createContext<ToastCtx>({ toast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const toast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toast-root">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === "success" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12" /></svg>}
            {t.type === "error" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
            {t.message}
            <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} style={{ marginLeft: "auto", background: "transparent", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: "0 0 0 6px", fontSize: "1rem" }}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() { return useContext(ToastContext); }
