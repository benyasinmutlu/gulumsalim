"use client";

import { useEffect, useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

const REASON_OPTIONS = [
  { value: "sahte_urun", label: "Sahte ürün" },
  { value: "gec_teslimat", label: "Geç teslimat" },
  { value: "kotu_iletisim", label: "Kötü iletişim" },
  { value: "hatali_urun", label: "Hatalı/eksik ürün" },
  { value: "diger", label: "Diğer" },
];

// bkz. kullanıcı isteği: "şikayet et kısmı çalışmıyor" - form önceden
// mağaza kapak fotoğrafının bulunduğu .vendor-hero kutusunun İÇİNDE
// position:absolute + top:100% ile açılıyordu; .vendor-hero'da
// overflow:hidden + sabit yükseklik olduğu ve buton kutunun en alt
// kenarına yapışık olduğu için açılan form görsel olarak neredeyse
// tamamen kırpılıyordu (DOM'da vardı, API isteği de çalışıyordu, ama
// kullanıcı hiçbir şey GÖRMÜYORDU). Ortadaki sabit bir modal'a taşındı -
// artık hangi ebeveyn kutusunun içine konursa konsun kırpılamaz.
export default function VendorComplaintButton({ vendorSlug, loggedIn }: { vendorSlug: string; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASON_OPTIONS[0]!.value);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!loggedIn) {
    return (
      <a href={`/giris?redirect=/${vendorSlug}`} className="btn btn-secondary" style={{ fontSize: 12 }}>
        <i className="fas fa-flag" /> Şikayet Et
      </a>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 10) {
      setError("Lütfen şikayetinizi en az 10 karakter olacak şekilde açıklayın");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await mutateJson(`/vendors/${vendorSlug}/complaints`, "POST", { reason, message: message.trim() });
      setSent(true);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Şikayet gönderilemedi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" style={{ fontSize: 12 }} onClick={() => setOpen(true)}>
        <i className="fas fa-flag" /> Şikayet Et
      </button>
      {open && (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
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
              width: "min(420px, 100%)",
              background: "#fff",
              borderRadius: 16,
              padding: 22,
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            }}
          >
            {sent ? (
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <i className="fas fa-circle-check" style={{ fontSize: 34, color: "var(--color-success, #2e7d32)", marginBottom: 12 }} />
                <p style={{ fontWeight: 600, marginBottom: 16 }}>Şikayetiniz alındı</p>
                <p style={{ fontSize: 13, color: "var(--color-text-light)", marginBottom: 16 }}>
                  Ekibimiz en kısa sürede inceleyecek.
                </p>
                <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)} style={{ width: "100%" }}>
                  Kapat
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>
                    <i className="fas fa-flag" style={{ color: "var(--color-primary)", marginRight: 8 }} /> Mağazayı Şikayet Et
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Kapat"
                    style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "var(--color-text-light)" }}
                  >
                    <i className="fas fa-xmark" />
                  </button>
                </div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Sebep
                  <select
                    className="form-control"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    style={{ marginTop: 6 }}
                  >
                    {REASON_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ fontSize: 13, fontWeight: 600 }}>
                  Açıklama
                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Ne yaşadığınızı kısaca anlatın..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    style={{ marginTop: 6 }}
                  />
                </label>
                {error && <p className="error-text" style={{ fontSize: 12 }}>{error}</p>}
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <button className="btn btn-pr" type="submit" disabled={loading} style={{ flex: 1 }}>
                    {loading ? "Gönderiliyor..." : "Gönder"}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
                    Vazgeç
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
