"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

interface FeedRow {
  id: number;
  vendorName: string;
  name: string;
  provider: string;
  feedHost: string;
  status: "active" | "paused" | "error";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  nextSyncAt: string;
  staleAfterMinutes: number;
  consecutiveFailures: number;
  lastError: string | null;
}

interface FeedRun {
  id: number;
  status: "running" | "success" | "unchanged" | "error" | "rejected";
  httpStatus: number | null;
  itemCount: number;
  createdCount: number;
  updatedCount: number;
  unchangedCount: number;
  deactivatedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString("tr-TR") : "—";
}

function operationalStatus(row: FeedRow) {
  if (row.status === "paused") return { label: "Duraklatıldı", color: "#7a6d72" };
  if (row.status === "error") return { label: "Hata", color: "#b3261e" };
  if (row.lastSuccessAt && Date.now() - new Date(row.lastSuccessAt).getTime() > row.staleAfterMinutes * 60_000) {
    return { label: "Gecikmiş", color: "#b3261e" };
  }
  if (!row.lastSuccessAt) return { label: "İlk kontrol bekleniyor", color: "#8a5a00" };
  return { label: "Aktif", color: "#247543" };
}

export default function FeedMonitor() {
  const [rows, setRows] = useState<FeedRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSourceId, setExpandedSourceId] = useState<number | null>(null);
  const [runsBySource, setRunsBySource] = useState<Record<number, FeedRun[]>>({});
  const [loadingRuns, setLoadingRuns] = useState<number | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      const result = await fetchJson<FeedRow[]>("/admin/feed-sources");
      setRows(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Entegrasyonlar alınamadı");
    } finally {
      if (!quiet) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(true);
    const timer = window.setInterval(() => void load(true), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function toggleRuns(sourceId: number) {
    if (expandedSourceId === sourceId) {
      setExpandedSourceId(null);
      return;
    }
    setExpandedSourceId(sourceId);
    if (runsBySource[sourceId]) return;
    setLoadingRuns(sourceId);
    try {
      const runs = await fetchJson<FeedRun[]>(`/admin/feed-sources/${sourceId}/runs`);
      setRunsBySource((current) => ({ ...current, [sourceId]: runs }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Feed işlem kayıtları alınamadı");
      setExpandedSourceId(null);
    } finally {
      setLoadingRuns(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <div>
          <h2>Satıcı Feed Entegrasyonları</h2>
          <p style={{ margin: "4px 0 0", color: "var(--admin-text-muted)", fontSize: 13 }}>XML/CSV/JSON kaynaklarının son çalışma ve hata durumları</p>
        </div>
        <button type="button" className="admin-btn admin-btn-secondary" disabled={refreshing} onClick={() => void load()}>
          <i className="fas fa-rotate" /> {refreshing ? "Yenileniyor…" : "Yenile"}
        </button>
      </div>
      {error ? <div className="admin-card-body" style={{ color: "#b3261e" }}>{error}</div> : rows === null ? (
        <div className="admin-card-body">Yükleniyor…</div>
      ) : rows.length === 0 ? (
        <div className="admin-empty"><i className="fas fa-plug" /><h3>Henüz feed entegrasyonu yok</h3></div>
      ) : (
        <div className="admin-card-body" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead><tr><th>Satıcı / Kaynak</th><th>Altyapı</th><th>Durum</th><th>Son Deneme</th><th>Son Başarı</th><th>Sonraki Kontrol</th><th>Hata</th><th>Kayıtlar</th></tr></thead>
            <tbody>{rows.map((row) => {
              const health = operationalStatus(row);
              const runs = runsBySource[row.id];
              return (
                <Fragment key={row.id}>
                  <tr>
                    <td><strong>{row.vendorName}</strong><br /><small>{row.name} • {row.feedHost}</small></td>
                    <td>{row.provider}</td>
                    <td><span style={{ color: health.color, fontWeight: 700 }}>{health.label}</span></td>
                    <td>{date(row.lastAttemptAt)}</td>
                    <td>{date(row.lastSuccessAt)}</td>
                    <td>{date(row.nextSyncAt)}</td>
                    <td style={{ maxWidth: 300, color: row.lastError ? "#b3261e" : undefined }}>{row.lastError ?? "—"}{row.consecutiveFailures > 0 ? ` (${row.consecutiveFailures} deneme)` : ""}</td>
                    <td><button type="button" className="admin-btn admin-btn-secondary" disabled={loadingRuns === row.id} onClick={() => void toggleRuns(row.id)}>{loadingRuns === row.id ? "Yükleniyor…" : expandedSourceId === row.id ? "Kapat" : "Geçmiş"}</button></td>
                  </tr>
                  {expandedSourceId === row.id && (
                    <tr>
                      <td colSpan={8} style={{ background: "var(--admin-surface-muted, #f8f7fb)" }}>
                        {!runs ? "Yükleniyor…" : runs.length === 0 ? "Henüz çalışma kaydı yok." : (
                          <table className="admin-table" aria-label={`${row.name} feed çalışma geçmişi`}>
                            <thead><tr><th>Başlangıç</th><th>Sonuç</th><th>HTTP</th><th>Okunan</th><th>Yeni</th><th>Güncellenen</th><th>Değişmeyen</th><th>Pasife alınan</th><th>Hata</th></tr></thead>
                            <tbody>{runs.map((run) => (
                              <tr key={run.id}>
                                <td>{date(run.startedAt)}</td><td>{run.status}</td><td>{run.httpStatus ?? "—"}</td>
                                <td>{run.itemCount}</td><td>{run.createdCount}</td><td>{run.updatedCount}</td>
                                <td>{run.unchangedCount}</td><td>{run.deactivatedCount}</td>
                                <td style={{ maxWidth: 320, color: run.error ? "#b3261e" : undefined }}>{run.error ?? "—"}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
