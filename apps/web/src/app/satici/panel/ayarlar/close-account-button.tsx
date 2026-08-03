"use client";

import { useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

const CONFIRM_PHRASE = "HESABIMI KAPAT";

// bkz. kullanıcı isteği (2026-08-02): "satıcı üyelik iptali olacak" -
// hesabim/delete-account-button.tsx ile aynı desen (yazarak onaylama).
export default function CloseAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/vendor/auth/me", "DELETE");
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Hesap kapatılamadı, tekrar deneyin.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>
        <i className="fas fa-store-slash" /> Hesabımı Kapat
      </button>
    );
  }

  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 10, border: "1px solid var(--er)", background: "rgba(248,113,113,.06)" }}>
      <p style={{ fontSize: "0.85rem", marginBottom: 8 }}>
        <strong>Bu işlem geri alınamaz.</strong> Bekleyen/tamamlanmamış siparişiniz varsa hesabınızı kapatamazsınız.
        Hiç ürününüz yoksa hesabınız tamamen silinir; ürününüz varsa mağazanız kapatılır ve tüm ürünleriniz
        yayından kaldırılır (vergi/muhasebe kayıtlarınız yasal saklama süresi için korunur).
      </p>
      <p style={{ fontSize: "0.85rem", marginBottom: 8 }}>
        Onaylamak için aşağıya <strong>{CONFIRM_PHRASE}</strong> yazın:
      </p>
      <input
        className="fi"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        style={{ marginBottom: 10, maxWidth: 260 }}
      />
      {error && <p style={{ color: "var(--er)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={confirmText.trim().toLocaleUpperCase("tr-TR") !== CONFIRM_PHRASE || loading}
          onClick={handleClose}
        >
          {loading ? "Kapatılıyor..." : "Hesabı Kalıcı Olarak Kapat"}
        </button>
        <button type="button" className="btn btn-sec btn-sm" onClick={() => setOpen(false)} disabled={loading}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}
