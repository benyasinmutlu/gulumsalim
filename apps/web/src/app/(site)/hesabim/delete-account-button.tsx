"use client";

import { useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";
import { hardNavigateInternal } from "@/lib/navigation";

const CONFIRM_PHRASE = "HESABIMI SİL";

// bkz. kullanıcı isteği (2026-08-02): "müşteri ... üyelik iptali olacak" -
// geri alınamaz bir işlem olduğu için basit bir confirm() yerine, kullanıcı
// belirli bir ifadeyi yazana kadar buton etkinleşmiyor (bkz. edit-product.tsx
// video silme gibi basit confirm() kullanan yerlerden kasıtlı olarak farklı,
// bu daha ağır bir sonuç).
export default function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      await mutateJson("/auth/me", "DELETE");
      hardNavigateInternal("/");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Hesap silinemedi, tekrar deneyin.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-danger btn-sm" onClick={() => setOpen(true)}>
        <i className="fas fa-user-slash" /> Hesabımı Sil
      </button>
    );
  }

  return (
    <div className="delete-account-panel">
      <p>
        <strong>Bu işlem geri alınamaz.</strong> Hesabınız kapatılır, kişisel bilgileriniz (ad, e-posta, telefon)
        anonimleştirilir. Daha önce siparişiniz/değerlendirmeniz yoksa hesabınız tamamen silinir.
      </p>
      <p>
        Onaylamak için aşağıya <strong>{CONFIRM_PHRASE}</strong> yazın:
      </p>
      <input
        className="fi"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={CONFIRM_PHRASE}
        style={{ marginBottom: 10, maxWidth: 260 }}
      />
      {error && <p style={{ color: "var(--color-error)", fontSize: "0.85rem", marginBottom: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={confirmText.trim().toLocaleUpperCase("tr-TR") !== CONFIRM_PHRASE || loading}
          onClick={handleDelete}
        >
          {loading ? "Siliniyor..." : "Kalıcı Olarak Sil"}
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(false)} disabled={loading}>
          Vazgeç
        </button>
      </div>
    </div>
  );
}
