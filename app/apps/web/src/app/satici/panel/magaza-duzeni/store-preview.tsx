"use client";

import { useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { VendorProfile } from "@/lib/types";

interface Props {
  refreshToken: number;
}

// bkz. kullanıcı isteği: "desktop görünümü çalışmıyor" - eski sürüm 1280px
// genişliğindeki iframe'i 480px'lik dar panelin içine olduğu gibi
// koyuyordu, kullanıcı yatay kaydırmadan sayfanın ~%35'inden fazlasını
// göremiyordu. Artık gerçek cihaz-önizleme araçlarındaki (Framer/Webflow)
// gibi, sabit genişlikte render edilip mevcut alana sığacak şekilde
// CSS transform:scale ile küçültülüyor - tüm sayfa tek bakışta görünür,
// iframe'in kendi iç kaydırması (tekerlek/dokunma) ölçeklense de çalışır.
const FRAME_SIZE: Record<"desktop" | "mobile", { width: number; height: number }> = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 780 },
};

export default function StorePreview({ refreshToken }: Props) {
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [containerWidth, setContainerWidth] = useState(430);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchJson<VendorProfile>("/vendor/auth/me").then((v) => setStoreSlug(v.storeSlug));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const frame = FRAME_SIZE[device];
  const scale = Math.min(containerWidth / frame.width, 1);
  const scaledHeight = frame.height * scale;

  return (
    <div className="card" style={{ position: "sticky", top: 20 }}>
      <div className="ch" style={{ justifyContent: "space-between" }}>
        <h3>
          <i className="fas fa-eye" /> Canlı Önizleme
        </h3>
        <div style={{ display: "flex", gap: 4, background: "var(--s2)", borderRadius: 8, padding: 3 }}>
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            title="Masaüstü"
            style={{
              border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer",
              background: device === "desktop" ? "var(--pr)" : "transparent",
              color: device === "desktop" ? "#fff" : "var(--tx3)",
            }}
          >
            <i className="fas fa-desktop" />
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            title="Mobil"
            style={{
              border: "none", borderRadius: 6, padding: "6px 10px", cursor: "pointer",
              background: device === "mobile" ? "var(--pr)" : "transparent",
              color: device === "mobile" ? "#fff" : "var(--tx3)",
            }}
          >
            <i className="fas fa-mobile-alt" />
          </button>
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: "0.8rem", color: "var(--tx3)", marginBottom: 12 }}>
          Kaydettiğiniz her değişiklikten sonra otomatik güncellenir. Masaüstü görünümü, tüm sayfayı tek bakışta görebilmeniz için ölçeklenerek gösterilir.
        </p>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            background: "var(--s2)",
            borderRadius: 12,
            padding: 12,
          }}
        >
          {!storeSlug ? (
            <p>Yükleniyor...</p>
          ) : (
            <div
              style={{
                width: frame.width * scale,
                maxWidth: "100%",
                height: scaledHeight,
                borderRadius: device === "mobile" ? 28 : 10,
                border: "6px solid var(--bg2, #1a1a1a)",
                overflow: "hidden",
                background: "#fff",
                boxShadow: "0 8px 24px rgba(0,0,0,.18)",
                flexShrink: 0,
              }}
            >
              <iframe
                key={refreshToken}
                src={`/${storeSlug}`}
                title="Mağaza önizlemesi"
                style={{
                  width: frame.width,
                  height: frame.height,
                  border: "none",
                  transform: `scale(${scale})`,
                  transformOrigin: "top left",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
