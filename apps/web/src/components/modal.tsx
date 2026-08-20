"use client";

import { useEffect } from "react";

// vendor-complaint-button.tsx'teki overlay/dialog/Escape/body-lock bloğunun
// çıkarılmış hali - kayıt (müşteri+satıcı) ve checkout sözleşme önizlemesi
// olmak üzere 3 bağımsız yerde aynı davranış gerektiği için tekilleştirildi.
export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(640px, 100%)",
          maxHeight: "85vh",
          overflowY: "auto",
          background: "#fff",
          borderRadius: 16,
          padding: 22,
          boxShadow: "0 20px 60px rgba(0,0,0,.3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          {title && <div style={{ fontWeight: 700, fontSize: 16 }}>{title}</div>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--color-text-light)", marginLeft: "auto" }}
          >
            <i className="fas fa-xmark" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
