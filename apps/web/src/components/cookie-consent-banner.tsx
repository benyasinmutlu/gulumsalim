"use client";

import { useEffect, useState } from "react";
import { getCookieConsent, setCookieConsent } from "@/lib/cookie-consent";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [performans, setPerformans] = useState(false);
  const [islevsellik, setIslevsellik] = useState(false);
  const [reklam, setReklam] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  if (!visible) return null;

  function acceptAll() {
    setCookieConsent({ performans: true, islevsellik: true, reklam: true });
    setVisible(false);
  }

  // KVKK'da alışılan "Kabul Et / Reddet / Tercihleri Yönet" üçlüsündeki
  // "Reddet" - işlev zaten buydu (tüm opsiyonel kategorileri false
  // kaydediyor), sadece buton etiketi netleştirildi.
  function rejectAll() {
    setCookieConsent({ performans: false, islevsellik: false, reklam: false });
    setVisible(false);
  }

  function saveCustom() {
    setCookieConsent({ performans, islevsellik, reklam });
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Çerez tercihleri"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 900,
        background: "#fff",
        borderTop: "1px solid var(--color-primary-light)",
        boxShadow: "0 -8px 30px rgba(0,0,0,.12)",
        padding: "16px 20px",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
        <p style={{ flex: "1 1 320px", margin: 0, fontSize: 13, color: "var(--color-text-light)" }}>
          Sitede deneyimi iyileştirmek için çerezler kullanıyoruz. Zorunlu çerezler her zaman aktiftir.{" "}
          <a href="/cerez-politikasi" target="_blank" rel="noopener noreferrer">Çerez Politikası</a>&apos;nı inceleyebilirsiniz.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreferencesOpen((v) => !v)}>
            Tercihleri Yönet
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={rejectAll}>
            Reddet
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={acceptAll}>
            Tümünü Kabul Et
          </button>
        </div>
      </div>

      {preferencesOpen && (
        <div style={{ maxWidth: 960, margin: "12px auto 0", display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked disabled /> Zorunlu Çerezler
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={performans} onChange={(e) => setPerformans(e.target.checked)} /> Performans Çerezleri
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={islevsellik} onChange={(e) => setIslevsellik(e.target.checked)} /> İşlevsellik Çerezleri
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" checked={reklam} onChange={(e) => setReklam(e.target.checked)} /> Reklam/Hedefleme Çerezleri
          </label>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveCustom}>
            Tercihleri Kaydet
          </button>
        </div>
      )}
    </div>
  );
}
