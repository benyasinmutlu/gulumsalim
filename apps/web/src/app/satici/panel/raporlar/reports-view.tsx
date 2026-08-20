"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { VendorReportData } from "@/lib/types";

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

const AY_ADLARI: Record<string, string> = {
  "01": "Oca", "02": "Şub", "03": "Mar", "04": "Nis", "05": "May", "06": "Haz",
  "07": "Tem", "08": "Ağu", "09": "Eyl", "10": "Eki", "11": "Kas", "12": "Ara",
};

export default function ReportsView() {
  const [data, setData] = useState<VendorReportData | null>(null);

  useEffect(() => {
    fetchJson<VendorReportData>("/vendor/reports").then(setData);
  }, []);

  if (data === null) return <div className="card"><div className="card-body">Yükleniyor...</div></div>;

  const maxMonth = Math.max(0, ...data.monthlySales.map((m) => Number(m.total)));

  return (
    <div>
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label">Toplam Ciro</div>
          <div className="sc-val">{tl(data.totalRevenue)}</div>
          <div className="sc-sub">iptaller hariç</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Net Kazanç</div>
          <div className="sc-val" style={{ color: "var(--ok)" }}>{tl(data.netEarnings)}</div>
          <div className="sc-sub">komisyon sonrası</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Bu Ay</div>
          <div className="sc-val">{tl(data.monthRevenue)}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label">Sipariş</div>
          <div className="sc-val">{data.totalOrders}</div>
          <div className="sc-sub">{data.totalQuantity} ürün satıldı</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="ch">
          <h3><i className="fas fa-chart-bar" style={{ color: "var(--pr)" }} /> Son 6 Ay Ciro</h3>
        </div>
        <div className="card-body">
          {data.monthlySales.length === 0 ? (
            <div className="empty" style={{ padding: 30 }}>
              <i className="fas fa-chart-line" />
              <p>Henüz satış verisi yok.</p>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 180, paddingTop: 10 }}>
              {data.monthlySales.map((m) => {
                const h = maxMonth > 0 ? Math.round((Number(m.total) / maxMonth) * 140) : 0;
                const [, mm] = m.month.split("-");
                return (
                  <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                    <div style={{ fontSize: 10, color: "var(--tx2)", whiteSpace: "nowrap" }}>
                      {Number(m.total).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}₺
                    </div>
                    <div style={{ width: "100%", maxWidth: 44, height: Math.max(h, 4), background: "linear-gradient(180deg, var(--pr), var(--ac))", borderRadius: "8px 8px 0 0" }} />
                    <div style={{ fontSize: 11, color: "var(--tx3)" }}>{AY_ADLARI[mm] ?? mm}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3><i className="fas fa-trophy" style={{ color: "var(--pr)" }} /> En Çok Satan Ürünler</h3>
        </div>
        {data.topProducts.length === 0 ? (
          <div className="empty">
            <i className="fas fa-box" />
            <p>Henüz satış yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ürün</th>
                  <th>Satılan Adet</th>
                  <th>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p, i) => (
                  <tr key={p.productId}>
                    <td><span className="st st-purple">{i + 1}</span></td>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.totalQuantity} adet</td>
                    <td><strong>{tl(p.totalRevenue)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
