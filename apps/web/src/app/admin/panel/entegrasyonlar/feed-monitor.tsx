"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

interface FeedRow {
  id: number;
  vendorName: string;
  name: string;
  provider: string;
  feedHost: string;
  status: "active" | "paused" | "error";
  lastSuccessAt: string | null;
  nextSyncAt: string;
  consecutiveFailures: number;
  lastError: string | null;
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString("tr-TR") : "—";
}

export default function FeedMonitor() {
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchJson<FeedRow[]>("/admin/feed-sources").then(setRows).catch((err) => setError(err instanceof Error ? err.message : "Entegrasyonlar alınamadı"));
  }, []);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Satıcı Feed Entegrasyonları</h2>
          <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 13 }}>XML/CSV/JSON kaynaklarının son çalışma ve hata durumları</p>
        </div>
      </div>
      {error ? <div className="admin-card-body" style={{ color: "#b3261e" }}>{error}</div> : rows === null ? (
        <div className="admin-card-body">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty"><i className="fas fa-plug" /><h3>Henüz feed entegrasyonu yok</h3></div>
      ) : (
        <div className="admin-card-body" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr><th>Satıcı / Kaynak</th><th>Altyapı</th><th>Durum</th><th>Son Başarı</th><th>Sonraki Kontrol</th><th>Hata</th></tr></thead>
            <tbody>{rows.map((row) => (
              <tr key={row.id}>
                <td><strong>{row.vendorName}</strong><br /><small>{row.name} • {row.feedHost}</small></td>
                <td>{row.provider}</td>
                <td><span style={{ color: row.status === "active" ? "#247543" : row.status === "error" ? "#b3261e" : "#7a6d72", fontWeight: 700 }}>{row.status === "active" ? "Aktif" : row.status === "error" ? "Hata" : "Duraklatıldı"}</span></td>
                <td>{date(row.lastSuccessAt)}</td>
                <td>{date(row.nextSyncAt)}</td>
                <td style={{ maxWidth: 300, color: row.lastError ? "#b3261e" : undefined }}>{row.lastError ?? "—"}{row.consecutiveFailures > 0 ? ` (${row.consecutiveFailures} deneme)` : ""}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
