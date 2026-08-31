"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { AdminAuditLogEntry } from "@/lib/types";

const ENTITY_LABEL: Record<string, string> = {
  vendor: "Satıcı",
  product: "Ürün",
  refund: "İade",
  payout: "Ödeme",
};

// bkz. denetim raporu: "İşlem logları" - admin panelinde kimin ne zaman
// hangi kararı verdiğine dair hiçbir kayıt yoktu. Başlangıç kapsamı en
// hassas/geri döndürülemez kararlarla sınırlı (satıcı onayı/yasaklama,
// ürün moderasyonu, iade/ödeme kararı) - bkz. apps/api admin-audit.repository.ts
// çağrı yerleri, kapsam ileride genişletilebilir.
export default function AuditLogView() {
  const [entries, setEntries] = useState<AdminAuditLogEntry[] | null>(null);

  useEffect(() => {
    fetchJson<AdminAuditLogEntry[]>("/admin/audit-log").then(setEntries);
  }, []);

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>İşlem Logları</h2>
      </div>
      <p style={{ padding: "0 20px", fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>
        Şu an yalnızca en hassas kararlar kaydediliyor: satıcı onayı/yasaklama, ürün moderasyonu, iade ve ödeme kararları.
      </p>
      {entries === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : entries.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-clipboard-list" />
          <h3>Henüz kayıtlı işlem yok</h3>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Yönetici</th>
                <th>Varlık</th>
                <th>Aksiyon</th>
                <th>Özet</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td style={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}>{new Date(entry.createdAt).toLocaleString("tr-TR")}</td>
                  <td>{entry.adminName}</td>
                  <td>
                    <span className="st st-muted">
                      {ENTITY_LABEL[entry.entityType] ?? entry.entityType}
                      {entry.entityId ? ` #${entry.entityId}` : ""}
                    </span>
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>{entry.action}</td>
                  <td style={{ fontSize: "0.85rem" }}>{entry.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
