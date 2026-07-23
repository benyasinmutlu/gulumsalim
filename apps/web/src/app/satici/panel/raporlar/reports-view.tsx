"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { VendorReportData } from "@/lib/types";

function tl(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

export default function ReportsView() {
  const [data, setData] = useState<VendorReportData | null>(null);

  useEffect(() => {
    fetchJson<VendorReportData>("/vendor/reports").then(setData);
  }, []);

  if (data === null) return <div className="card"><div className="card-body">Yükleniyor...</div></div>;

  const maxSale = Math.max(1, ...data.dailySales.map((d) => Number(d.total)));

  return (
    <div>
      <div className="card">
        <div className="ch">
          <h3>Son 14 Gün Satış</h3>
        </div>
        <div className="card-body">
          {data.dailySales.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Bu dönemde satış yok.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
              {data.dailySales.map((d) => (
                <div key={d.day} style={{ flex: 1, textAlign: "center" }}>
                  <div
                    title={tl(d.total)}
                    style={{
                      height: `${Math.max(4, (Number(d.total) / maxSale) * 140)}px`,
                      background: "linear-gradient(135deg, var(--pr), var(--ac))",
                      borderRadius: "4px 4px 0 0",
                    }}
                  />
                  <div style={{ fontSize: 10, color: "var(--tx3)", marginTop: 4 }}>
                    {new Date(d.day).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>En Çok Satan Ürünler</h3>
        </div>
        {data.topProducts.length === 0 ? (
          <div className="empty">
            <i className="fas fa-chart-bar" />
            <p>Henüz satış verisi yok.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Adet</th>
                  <th>Ciro</th>
                </tr>
              </thead>
              <tbody>
                {data.topProducts.map((p) => (
                  <tr key={p.productId}>
                    <td>{p.name}</td>
                    <td>{p.totalQuantity}</td>
                    <td>{tl(p.totalRevenue)}</td>
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
