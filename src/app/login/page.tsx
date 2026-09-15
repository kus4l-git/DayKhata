"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetCode, setResetCode] = useState<string | null>(null);
  const [resetVerifying, setResetVerifying] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Invalid credentials or account temporarily locked.");
      return;
    }
    router.replace("/dashboard");
  }

  async function verifyAdminEmail() {
    setError(null);
    setResetVerifying(true);
    const res = await fetch("/api/auth/verify-admin-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setResetVerifying(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError("Admin verification failed. Check the email address."); return; }
    setResetCode(data.resetCode ?? null);
  }

  async function resetPassword() {
    if (!resetCode) return;
    const newPassword = prompt("Enter new password (min 8 characters)");
    if (!newPassword) return;
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, resetCode, newPassword }),
    });
    if (!res.ok) { setError("Reset failed. Code may have expired."); return; }
    setMode("login");
    setResetCode(null);
    setError(null);
    setEmail("");
    setPassword("");
  }

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient decorative gradient orbs */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(120,120,255,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-10%",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(180,160,255,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Main card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "400px",
          background: "var(--surface)",
          borderRadius: "20px",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02), 0 8px 32px rgba(0,0,0,0.04)",
          padding: "44px 40px 36px",
        }}
      >
        {/* Logo mark */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "32px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "14px",
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.8" fill="rgba(255,255,255,0.95)" />
              <rect x="9" y="1" width="6" height="6" rx="1.8" fill="rgba(255,255,255,0.5)" />
              <rect x="1" y="9" width="6" height="6" rx="1.8" fill="rgba(255,255,255,0.5)" />
              <rect x="9" y="9" width="6" height="6" rx="1.8" fill="rgba(255,255,255,0.75)" />
            </svg>
          </div>
        </div>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 600,
              letterSpacing: "-0.03em",
              color: "var(--fg)",
              lineHeight: 1.2,
              marginBottom: "6px",
            }}
          >
            {mode === "login" ? "Welcome back" : "Reset password"}
          </h1>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--fg-muted)",
              lineHeight: 1.5,
            }}
          >
            {mode === "login"
              ? "Sign in to your KusHQ workspace"
              : "Verify your admin email to continue"}
          </p>
        </div>

        {/* Login form */}
        {mode === "login" && (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 500,
                  color: "var(--fg-muted)",
                  letterSpacing: "0.01em",
                }}
              >
                Email
              </label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={{
                  height: "42px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0 14px",
                  fontSize: "0.875rem",
                  color: "var(--fg)",
                  outline: "none",
                  transition: "border-color 150ms, box-shadow 150ms",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-focus)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(120,120,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 500,
                  color: "var(--fg-muted)",
                  letterSpacing: "0.01em",
                }}
              >
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                style={{
                  height: "42px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0 14px",
                  fontSize: "0.875rem",
                  color: "var(--fg)",
                  outline: "none",
                  transition: "border-color 150ms, box-shadow 150ms",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-focus)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(120,120,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "var(--status-inactive-bg)",
                  border: "1px solid rgba(185,28,28,0.12)",
                  fontSize: "0.8rem",
                  color: "var(--status-inactive-fg)",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={pending}
              style={{
                marginTop: "4px",
                height: "42px",
                width: "100%",
                background: pending ? "var(--accent-hover)" : "var(--accent)",
                color: "#fff",
                border: "none",
                borderRadius: "10px",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: pending ? "not-allowed" : "pointer",
                transition: "background 150ms, transform 100ms",
                letterSpacing: "-0.01em",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => { if (!pending) e.currentTarget.style.background = "var(--accent-hover)"; }}
              onMouseLeave={(e) => { if (!pending) e.currentTarget.style.background = "var(--accent)"; }}
              onMouseDown={(e) => { if (!pending) e.currentTarget.style.transform = "scale(0.985)"; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
            >
              {pending ? (
                <>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="rgba(255,255,255,0.7)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ animation: "spin 0.7s linear infinite" }}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <button
              type="button"
              onClick={() => { setMode("reset"); setError(null); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "var(--fg-subtle)",
                textAlign: "center",
                padding: "4px 0",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-subtle)")}
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* Reset flow */}
        {mode === "reset" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label
                style={{
                  fontSize: "0.775rem",
                  fontWeight: 500,
                  color: "var(--fg-muted)",
                  letterSpacing: "0.01em",
                }}
              >
                Admin email
              </label>
              <input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@company.com"
                style={{
                  height: "42px",
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "0 14px",
                  fontSize: "0.875rem",
                  color: "var(--fg)",
                  outline: "none",
                  transition: "border-color 150ms, box-shadow 150ms",
                  width: "100%",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-focus)";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(120,120,255,0.08)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
            </div>

            <button
              onClick={verifyAdminEmail}
              disabled={resetVerifying || !email}
              style={{
                height: "42px",
                background: "var(--bg-subtle)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "0.85rem",
                fontWeight: 500,
                color: "var(--fg)",
                cursor: resetVerifying || !email ? "not-allowed" : "pointer",
                opacity: resetVerifying || !email ? 0.5 : 1,
                transition: "background 150ms, opacity 150ms",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => { if (!resetVerifying && email) e.currentTarget.style.background = "var(--surface-raised)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-subtle)"; }}
            >
              {resetVerifying ? (
                <>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ animation: "spin 0.7s linear infinite" }}
                  >
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Verifying…
                </>
              ) : (
                "Verify admin email"
              )}
            </button>

            {resetCode && (
              <div
                style={{
                  background: "var(--bg-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--fg-subtle)",
                      marginBottom: "6px",
                    }}
                  >
                    Reset code
                  </p>
                  <p
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, monospace",
                      fontSize: "0.75rem",
                      color: "var(--fg)",
                      wordBreak: "break-all",
                      letterSpacing: "0.04em",
                      lineHeight: 1.6,
                    }}
                  >
                    {resetCode.slice(0, 32)}…
                  </p>
                </div>
                <button
                  onClick={resetPassword}
                  style={{
                    height: "38px",
                    background: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "10px",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 150ms, transform 100ms",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--accent-hover)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--accent)")}
                  onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.985)")}
                  onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  Set new password
                </button>
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background: "var(--status-inactive-bg)",
                  border: "1px solid rgba(185,28,28,0.12)",
                  fontSize: "0.8rem",
                  color: "var(--status-inactive-fg)",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={() => { setMode("login"); setError(null); setResetCode(null); }}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: "var(--fg-subtle)",
                textAlign: "center",
                padding: "4px 0",
                transition: "color 150ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--fg-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--fg-subtle)")}
            >
              ← Back to sign in
            </button>
          </div>
        )}

        {/* Footer */}
        <p
          style={{
            marginTop: "32px",
            fontSize: "0.7rem",
            color: "var(--fg-subtle)",
            textAlign: "center",
            lineHeight: 1.5,
            letterSpacing: "0.01em",
          }}
        >
          Secure · Private · KusHQ
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </main>
  );
}