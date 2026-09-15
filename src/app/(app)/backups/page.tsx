"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BackupBadge, Button, EmptyState, SkeletonCard } from "@/components/ui";
import { useToast } from "@/components/modals";
import { apiGet, apiSend } from "@/lib/api-client";

type BackupRow = {
  id: string;
  status: string;
  provider: string;
  fileName: string | null;
  sizeBytes: number | null;
  startedAt: string;
  finishedAt: string | null;
  details: { message?: string } | null;
};

function fmtBytes(b: number | null): string {
  if (!b) return "—";
  const k = 1024, s = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

const STATUS_GRADIENTS: Record<string, string> = {
  SUCCESS: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)",
  FAILED:  "linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #991b1b 100%)",
  RUNNING: "linear-gradient(135deg, #451a03 0%, #78350f 50%, #92400e 100%)",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  SUCCESS: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  FAILED:  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  RUNNING: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" style={{ animation: "spin 1.2s linear infinite" }}><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>,
};

const Icons = {
  backup: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>,
  recover: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" /></svg>,
  info: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>,
};

export default function BackupsPage() {
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () => apiGet<{ items: BackupRow[] }>("/api/backups"),
  });

  const action = useMutation({
    mutationFn: (op: "create" | "recover") =>
      apiSend<{ item: BackupRow }>("/api/backups", "POST", { action: op }),
    onSuccess: (_, op) => {
      queryClient.invalidateQueries({ queryKey: ["backups"] });
      toast(op === "create" ? "Backup started" : "Recovery started", "success");
    },
    onError: (e: Error) => toast(e.message || "Operation failed", "error"),
  });

  const items = backups.data?.items ?? [];
  const successCount = items.filter((i) => i.status === "SUCCESS").length;
  const successRate  = items.length > 0 ? Math.round((successCount / items.length) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <div className="page-header">
        <div className="page-header-left">
          <span className="page-kicker">Recovery</span>
          <h1 className="page-title">Backup & Recovery</h1>
          <p className="page-subtitle">Server-side backup orchestration via MEGA. Credentials stored server-side only.</p>
        </div>
        <div className="page-actions">
          <Button variant="ghost" size="md" icon={Icons.recover} loading={action.isPending && action.variables === "recover"} onClick={() => action.mutate("recover")}>Run Recovery</Button>
          <Button variant="primary" size="md" icon={Icons.backup} loading={action.isPending && action.variables === "create"} onClick={() => action.mutate("create")}>Create Backup</Button>
        </div>
      </div>

      {/* Stats row */}
      {items.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Backups", value: items.length, color: "#3b82f6" },
            { label: "Success Rate",  value: `${successRate}%`, color: "#22c55e" },
            { label: "Last Status",   value: items[0]?.status ?? "—", color: items[0]?.status === "SUCCESS" ? "#22c55e" : items[0]?.status === "FAILED" ? "#ef4444" : "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-xl)", padding: "16px 20px", boxShadow: "var(--shadow-xs)" }}>
              <p style={{ fontSize: "0.68rem", fontWeight: 650, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>{s.label}</p>
              <p style={{ marginTop: 8, fontSize: "1.6rem", fontWeight: 650, letterSpacing: "-0.03em", color: s.color, lineHeight: 1 }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Info notice */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", background: "var(--status-info-bg)", border: "1px solid rgba(29,78,216,0.15)", borderRadius: "var(--radius-lg)", fontSize: "0.8rem", color: "var(--status-info-fg)", lineHeight: 1.5, marginBottom: 20 }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{Icons.info}</span>
        <p>Configure <code style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", background: "rgba(29,78,216,0.08)", padding: "0 4px", borderRadius: 3 }}>MEGA_EMAIL</code> and <code style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem", background: "rgba(29,78,216,0.08)", padding: "0 4px", borderRadius: 3 }}>MEGA_PASSWORD</code> in your environment to enable backups.</p>
      </div>

      {/* Timeline */}
      {backups.isLoading && !backups.data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} height={130} />)}
        </div>
      )}

      {!backups.isLoading && items.length === 0 && (
        <EmptyState
          title="No backup history"
          description="Create your first backup to initialize recovery history."
          action={<Button variant="primary" size="sm" icon={Icons.backup} onClick={() => action.mutate("create")}>Create Backup</Button>}
          icon={<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>}
        />
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {items.map((item, i) => (
            <BackupCard key={item.id} item={item} index={i} total={items.length} />
          ))}
        </div>
      )}
    </div>
  );
}

function BackupCard({ item, index, total }: { item: BackupRow; index: number; total: number }) {
  const gradient = STATUS_GRADIENTS[item.status] ?? STATUS_GRADIENTS.RUNNING;
  const icon     = STATUS_ICONS[item.status] ?? STATUS_ICONS.RUNNING;

  return (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      {/* Timeline spine */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 16, flexShrink: 0, paddingTop: 20 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: item.status === "SUCCESS" ? "#22c55e" : item.status === "FAILED" ? "#ef4444" : "#f59e0b", boxShadow: `0 0 0 3px ${item.status === "SUCCESS" ? "#22c55e22" : item.status === "FAILED" ? "#ef444422" : "#f59e0b22"}` }} />
        {index < total - 1 && <div style={{ width: 1, flex: 1, minHeight: 32, background: "var(--border)", marginTop: 4 }} />}
      </div>

      {/* Card */}
      <div className="pin-card" style={{ flex: 1, cursor: "default" }}>
        {/* Thumb */}
        <div style={{ height: 80, background: gradient, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: "var(--radius-pill)", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            {icon}
          </div>
          <span className="pin-badge" style={{ left: 10 }}>
            {item.provider}
          </span>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)", backgroundSize: "14px 14px", pointerEvents: "none" }} />
        </div>

        <div className="pin-body">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <BackupBadge status={item.status} />
            {item.fileName && (
              <span style={{ fontSize: "0.775rem", color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>
                {item.fileName}
              </span>
            )}
          </div>
          {item.details?.message && (
            <p style={{ fontSize: "0.775rem", color: "var(--fg-muted)", lineHeight: 1.5, marginTop: 4 }}>{item.details.message}</p>
          )}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
            {[
              ["Started",  new Date(item.startedAt).toLocaleString()],
              ["Duration", fmtDuration(item.startedAt, item.finishedAt)],
              ["Size",     fmtBytes(item.sizeBytes)],
            ].map(([k, v]) => (
              <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: "0.68rem", fontWeight: 650, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-subtle)" }}>{k}</span>
                <span style={{ fontSize: "0.775rem", color: "var(--fg-muted)" }}>{v}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
