"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { AdminDashboardLiveData, AdminLiveProductStat } from "@/lib/types";
import { VisitorsLineChart } from "@/components/dashboard-charts";

const POLL_MS = 12_000;

function formatPrice(value: string) {
  return `${Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`;
}

// Ürün detay sayfası yollarını okunur isimlere çeviremeyiz (path'te sadece
// slug var) - ham path'i kısaltıp gösteriyoruz, admin dilerse tıklayıp
// gidebilir.
function ProductStatTable({ rows, valueLabel, valueOf }: { rows: AdminLiveProductStat[]; valueLabel: string; valueOf: (r: AdminLiveProductStat) => string | number }) {
  if (rows.length === 0) {
    return <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>Bugün henüz veri yok.</p>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table">
        <thead>
          <tr>
            <th></th>
            <th>Ürün</th>
            <th>Kategori</th>
            <th>{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.productId}>
              <td>
                {r.primaryImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.primaryImageUrl} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 8 }} />
                ) : (
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--admin-surface-2)" }} />
                )}
              </td>
              <td>{r.productName}</td>
              <td style={{ fontSize: "0.85rem" }}>{r.categoryName}</td>
              <td>{valueOf(r)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
// görebilmeliyim ve bunun gibi bir çok detayı analizi admin panelden
// görüntülemeliyim ... anlık ziyaretçi sayıları en çok sayfada hangi üründe
// nerde kaç saniye duruldu hangilerine en çok tıklanıldı" - gösterge
// panelinin üstünde, periyodik olarak GET /admin/dashboard/live'ı çeken
// ayrı bir istemci bileşeni (sunucu bileşeni tek seferlik render olduğu
// için "anlık" burada olamaz).
export default function LiveAnalyticsPanel() {
  const [data, setData] = useState<AdminDashboardLiveData | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchJson<AdminDashboardLiveData>("/admin/dashboard/live")
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!data) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div className="admin-fin-stats">
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(34,197,94,.12)", color: "#22c55e" }}>
            <i className="fas fa-circle" style={{ fontSize: 10 }} />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{data.onlineNow}</div>
            <div className="lbl">Şu An Sitede</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(0,180,216,.12)", color: "var(--admin-info)" }}>
            <i className="fas fa-user-check" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{data.visitorsToday}</div>
            <div className="lbl">Bugünkü Ziyaretçi</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "var(--admin-accent-light)", color: "var(--admin-accent)" }}>
            <i className="fas fa-shopping-bag" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{data.todaySummary.orders}</div>
            <div className="lbl">Bugünkü Sipariş</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "var(--admin-primary-light)", color: "var(--admin-primary)" }}>
            <i className="fas fa-lira-sign" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{formatPrice(data.todaySummary.revenue)}</div>
            <div className="lbl">Bugünkü Ciro</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(0,214,143,.12)", color: "var(--admin-success)" }}>
            <i className="fas fa-user-plus" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{data.todaySummary.newCustomers}</div>
            <div className="lbl">Bugün Kayıt Olan</div>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-map-marker-alt" /> Şu An Hangi Sayfada</h2>
          </div>
          {data.activePages.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>Şu anda aktif ziyaretçi yok.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: "8px 20px 16px", margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.activePages.slice(0, 10).map((p) => (
                <li key={p.path} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: 12 }}>{p.path}</span>
                  <span className="admin-badge admin-badge-processing">{p.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-chart-line" /> Son 7 Gün Tekil Ziyaretçi</h2>
          </div>
          <div className="admin-card-body">
            <VisitorsLineChart data={data.visitorsLast7Days} />
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-eye" /> Bugün En Çok Görüntülenen</h2>
          </div>
          <ProductStatTable rows={data.topViewedToday} valueLabel="Görüntülenme" valueOf={(r) => r.count ?? 0} />
        </div>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-shopping-cart" /> Bugün En Çok Satılan</h2>
          </div>
          <ProductStatTable rows={data.topPurchasedToday} valueLabel="Adet" valueOf={(r) => r.quantity ?? 0} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-stopwatch" /> Ürünlerde Ortalama Kalma Süresi (Bugün)</h2>
          </div>
          <ProductStatTable rows={data.avgDwellToday} valueLabel="Ort. Süre" valueOf={(r) => `${r.avgSeconds ?? 0} sn`} />
        </div>
        <div className="admin-card" style={{ minWidth: 0 }}>
          <div className="admin-card-header">
            <h2><i className="fas fa-layer-group" /> Bugün En Popüler Kategoriler</h2>
          </div>
          {data.topCategoriesToday.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--admin-text-muted)", padding: "12px 20px" }}>Bugün henüz veri yok.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: "8px 20px 16px", margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {data.topCategoriesToday.map((c) => (
                <li key={c.categorySlug} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                  <span>{c.categoryName}</span>
                  <span className="admin-badge admin-badge-processing">{c.totalViews}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
