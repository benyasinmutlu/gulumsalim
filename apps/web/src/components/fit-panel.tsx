"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/client-api";

// "Beden Uyum Önerisi" — Fit-Zekâsı paneli. Giriş yapmış müşterinin bedeni/boyu ile
// bu ürünün beden önerisi + boyut-boyut fit. Backend: GET /products/:slug/fit.

interface DimFit { dimension: "bust" | "waist" | "hip"; status: "tight" | "fits" | "loose"; deltaCm: number; }
interface FitOk {
  status: "ok";
  result: { recommendedSize: string; alternativeSize?: string; dimensions: DimFit[]; lengthNote: "short" | "long" | "ok" | null; score: number };
  anchor: { size: number; source: string; confidence: number };
}
type FitResp = FitOk | { status: "no_measurements" } | { status: "no_sizes" };

const DIM_LABEL: Record<string, string> = { bust: "Göğüs", waist: "Bel", hip: "Kalça" };
const STATUS_META: Record<string, { t: string; bg: string; fg: string }> = {
  tight: { t: "Dar", bg: "#fdeaea", fg: "#b3261e" },
  fits: { t: "Tam", bg: "#e7f6ec", fg: "#1e7d43" },
  loose: { t: "Bol", bg: "#fff4e5", fg: "#9a5b00" },
};
const LEN_TEXT: Record<string, string> = { short: "Boyun uzun — boy kısa gelebilir", long: "Boyun kısa — boy uzun gelebilir" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--color-border, #ecdfe4)", borderRadius: 14, padding: "14px 16px", background: "var(--color-surface, #fff)", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <i className="fas fa-ruler-combined" style={{ color: "var(--color-primary, #b0446b)" }} />
        <strong style={{ fontSize: 15 }}>Beden Uyum Önerisi</strong>
      </div>
      {children}
    </div>
  );
}

export default function FitPanel({ slug }: { slug: string }) {
  const [data, setData] = useState<FitResp | "guest" | null>(null);
  useEffect(() => {
    let alive = true;
    fetchJson<FitResp>(`/products/${slug}/fit`)
      .then((r) => alive && setData(r))
      .catch(() => alive && setData("guest"));
    return () => { alive = false; };
  }, [slug]);

  if (data === null) return null; // yükleniyor
  if (data === "guest") {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-light, #6b5a62)" }}>
          Bedenine uygun beden önerisini görmek için <Link href="/giris" style={{ color: "var(--color-primary, #b0446b)", fontWeight: 600 }}>giriş yap</Link>.
        </p>
      </Shell>
    );
  }
  if (data.status === "no_sizes") return null; // ürünün beden bilgisi yok → panel gizli
  if (data.status === "no_measurements") {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--color-text-light, #6b5a62)" }}>
          Sana özel beden önerisi için profilinden <Link href="/hesabim" style={{ color: "var(--color-primary, #b0446b)", fontWeight: 600 }}>beden ve boy bilgini</Link> ekle.
        </p>
      </Shell>
    );
  }

  const { result } = data;
  return (
    <Shell>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <span style={{ background: "var(--color-primary, #b0446b)", color: "#fff", fontWeight: 700, fontSize: 14, padding: "4px 12px", borderRadius: 999 }}>
          Önerilen beden: {result.recommendedSize}
        </span>
        {result.alternativeSize && (
          <span style={{ fontSize: 12.5, color: "var(--color-text-light, #6b5a62)" }}>alternatif: {result.alternativeSize}</span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--color-text-light, #6b5a62)" }} title="Güven skoru">%{result.score} güven</span>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {result.dimensions.map((d) => {
          const m = STATUS_META[d.status]!;
          return (
            <span key={d.dimension} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: m.bg, color: m.fg, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600 }}>
              {DIM_LABEL[d.dimension]}: {m.t}
            </span>
          );
        })}
      </div>

      {result.lengthNote && result.lengthNote !== "ok" && LEN_TEXT[result.lengthNote] && (
        <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "#9a5b00" }}>
          <i className="fas fa-circle-info" /> {LEN_TEXT[result.lengthNote]}
        </p>
      )}
      <p style={{ margin: "10px 0 0", fontSize: 11, color: "var(--color-text-light, #9a8b92)" }}>
        Profilindeki beden ve boy bilgine göre tahmindir; kalıp ürüne göre değişebilir.
      </p>
    </Shell>
  );
}
