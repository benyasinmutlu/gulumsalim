"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/client-api";
import type { AdminBannerStat, AdminContentAnalyticsData, AdminContentStat } from "@/lib/types";

const PERIODS: { value: "day" | "week" | "month"; label: string }[] = [
  { value: "day", label: "Gün" },
  { value: "week", label: "Hafta" },
  { value: "month", label: "Ay" },
];

function StatTable({
  rows,
  valueLabel,
  valueOf,
  emptyLabel = "Bu aralıkta henüz veri yok.",
}: {
  rows: AdminContentStat[];
  valueLabel: string;
  valueOf: (r: AdminContentStat) => string | number;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>{emptyLabel}</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>İçerik</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.contentId}>
              <td>
                {r.primaryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.primaryImageUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--admin-surface-2)" }} />
                )}
              </td>
              <td>
                {r.href ? (
                  <Link href={r.href} target="_blank" style={{ color: "inherit" }}>
                    {r.name}
                  </Link>
                ) : (
                  r.name
                )}
                {r.subtitle && <div style={{ fontSize: "0.78rem", color: "var(--admin-text-muted)" }}>{r.subtitle}</div>}
              </td>
              <td>{valueOf(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BannerStatTable({ rows }: { rows: AdminBannerStat[] }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>Bu aralıkta henüz veri yok.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Banner</th>
            <th>Görüntülenme</th>
            <th>Tıklama</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={b.image} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
              </td>
              <td>{b.title}</td>
              <td>{b.views}</td>
              <td>{b.clicks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// bkz. kullanıcı isteği (2026-08-02): "kategoriler sayfalar koleksiyonlar
// mağazalar kampanyalar ... çok önemli bunlar ... elimizde veri olursa
// bunlara göre arayüzü değiştirebiliriz" - gösterge panelinden ayrı, gün/
// hafta/ay kırılımlı kalıcı içerik analitiği (bkz. GET /admin/content-analytics,
// content_events tablosu - live-analytics-panel.tsx'in "bugün" anlık
// versiyonundan farklı olarak burada geçmişe dönük, kalıcı veri var).
export default function ContentAnalyticsPage() {
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [data, setData] = useState<AdminContentAnalyticsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<AdminContentAnalyticsData>(`/admin/content-analytics?period=${period}`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>İçerik Analitiği</h2>
        <div style={{ display: "flex", gap: 8 }}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={period === p.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {!data ? (
        <div className="admin-card">
          <div className="admin-card-body">Yükleniyor...</div>
        </div>
      ) : (
        <>
          <div className="admin-card">
            <div className="admin-card-header">
              <h2><i className="fas fa-tshirt" /> Ürünler</h2>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
              <div>
                <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Görüntülenme</h3>
                <StatTable rows={data.products.views} valueLabel="Görüntülenme" valueOf={(r) => r.total} />
              </div>
              <div>
                <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Satın Alma</h3>
                <StatTable rows={data.products.purchases} valueLabel="Adet" valueOf={(r) => r.total} />
              </div>
              <div>
                <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Favoriye Ekleme</h3>
                <StatTable rows={data.products.favorites} valueLabel="Favori" valueOf={(r) => r.total} />
              </div>
              <div>
                <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Sepete Ekleme</h3>
                <StatTable rows={data.products.cartAdds} valueLabel="Sepete Ekleme" valueOf={(r) => r.total} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Ortalama Kalma Süresi</h3>
                <StatTable rows={data.products.dwell} valueLabel="Ort. Süre" valueOf={(r) => `${Math.round(r.total / Math.max(r.count, 1) / 1000)} sn`} />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-tags" /> Kategoriler</h2>
              </div>
              <StatTable rows={data.categories} valueLabel="Görüntülenme" valueOf={(r) => r.total} />
            </div>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-layer-group" /> Koleksiyonlar</h2>
              </div>
              <StatTable rows={data.collections} valueLabel="Görüntülenme" valueOf={(r) => r.total} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-store" /> Mağazalar</h2>
              </div>
              <StatTable rows={data.vendors} valueLabel="Görüntülenme" valueOf={(r) => r.total} />
            </div>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-th-large" /> Anasayfa Bölümleri</h2>
              </div>
              <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Görüntülenme</h3>
              <StatTable rows={data.homepageSections.views} valueLabel="Görüntülenme" valueOf={(r) => r.total} />
              <h3 style={{ padding: "12px 20px 0", fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>Ortalama Kalma Süresi</h3>
              <StatTable rows={data.homepageSections.dwell} valueLabel="Ort. Süre" valueOf={(r) => `${Math.round(r.total / Math.max(r.count, 1) / 1000)} sn`} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-bullhorn" /> Kampanya Bannerları</h2>
              </div>
              <BannerStatTable rows={data.banners} />
            </div>
            <div className="admin-card" style={{ minWidth: 0 }}>
              <div className="admin-card-header">
                <h2><i className="fas fa-search" /> Aranan Kelimeler</h2>
              </div>
              {data.searchQueries.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>Bu aralıkta henüz arama yok.</p>
              ) : (
                <ul style={{ listStyle: "none", padding: "8px 20px 16px", margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                  {data.searchQueries.map((s) => (
                    <li key={s.query} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                      <span>{s.query}</span>
                      <span className="admin-badge admin-badge-processing">{s.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
