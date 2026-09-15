"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { Button, Spinner } from "@/components/ui";

// Re-export toast hook so pages can import from either location
export { useToast } from "@/components/ui";

/* ============================================================
   MODAL
   ============================================================ */
export function Modal({
  open, onClose, title, subtitle, children, footer, width = 460,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; footer?: ReactNode; width?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-panel" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={{ maxWidth: `${width}px` }}>
        <div className="modal-header">
          <div>
            <h2 id="modal-title" className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </>
  );
}

/* ============================================================
   DRAWER
   ============================================================ */
export function Drawer({
  open, onClose, title, subtitle, children, footer,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = ""; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div>
            <h2 id="drawer-title" className="modal-title">{title}</h2>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="modal-body-scroll">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </>
  );
}

/* ============================================================
   CONFIRM MODAL
   ============================================================ */
export function ConfirmModal({
  open, onClose, onConfirm, title, description, confirmLabel = "Confirm", danger = false, loading,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; description?: string; confirmLabel?: string; danger?: boolean; loading?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={380}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={danger ? "danger" : "primary"} size="sm" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      {description && <p style={{ fontSize: "0.85rem", color: "var(--fg-muted)", lineHeight: 1.6 }}>{description}</p>}
    </Modal>
  );
}

/* ============================================================
   PIN MODAL
   ============================================================ */
export function PinModal({
  open, onClose, onSubmit, title = "Enter your PIN", subtitle = "This action requires PIN verification.",
  loading, error,
}: {
  open: boolean; onClose: () => void; onSubmit: (pin: string) => void;
  title?: string; subtitle?: string; loading?: boolean; error?: string | null;
}) {
  const [pin, setPin] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) { setPin(""); setTimeout(() => inputRef.current?.focus(), 80); } }, [open]);

  return (
    <Modal open={open} onClose={onClose} title={title} subtitle={subtitle} width={360}
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={() => pin.trim() && onSubmit(pin.trim())} loading={loading} disabled={!pin.trim()}>Verify</Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <input
          ref={inputRef}
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && pin.trim() && onSubmit(pin.trim())}
          placeholder="••••"
          maxLength={12}
          autoComplete="off"
          style={{
            height: "42px", width: "100%",
            background: "var(--surface)",
            border: `1px solid ${error ? "#f87171" : "var(--border-strong)"}`,
            borderRadius: "var(--radius-md)",
            padding: "0 14px",
            fontSize: "1.4rem", letterSpacing: "0.28em", color: "var(--fg)",
            outline: "none", textAlign: "center",
            transition: "border-color var(--dur-fast) var(--ease-out)",
          }}
          onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "var(--border-focus)"; }}
          onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = "var(--border-strong)"; }}
        />
        {error && <p style={{ fontSize: "0.775rem", color: "#b91c1c", textAlign: "center" }}>{error}</p>}
      </div>
    </Modal>
  );
}

/* ============================================================
   FORM HELPERS
   ============================================================ */
export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="form-grid">{children}</div>;
}
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="form-row">{children}</div>;
}

/* ============================================================
   FIELD INPUT (inline helper for forms)
   ============================================================ */
export function FieldInput({
  label, required, error, ...props
}: { label: string; required?: boolean; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span className="field-required">*</span>}
      </label>
      <input
        {...props}
        className={`field-input${error ? " error" : ""}`}
        onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = "var(--border-focus)"; props.onFocus?.(e); }}
        onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = "var(--border-strong)"; props.onBlur?.(e); }}
      />
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function FieldSelect({
  label, required, error, children, ...props
}: { label: string; required?: boolean; error?: string; children: ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="field-label">
        {label}{required && <span className="field-required">*</span>}
      </label>
      <select {...props} className={`field-select${error ? " error" : ""}`} style={{ width: "100%", ...props.style }}>
        {children}
      </select>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
