"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminQuestionRow } from "@/lib/types";

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Tümü" },
  { value: "pending", label: "Bekleyen" },
  { value: "answered", label: "Cevaplanan" },
];

export default function QuestionsModeration() {
  const [questions, setQuestions] = useState<AdminQuestionRow[] | null>(null);
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const qs = filter ? `?filter=${filter}` : "";
    setQuestions(await fetchJson<AdminQuestionRow[]>(`/admin/questions${qs}`));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function remove(id: number) {
    if (!confirm("Bu soruyu kaldırmak istediğinize emin misiniz?")) return;
    setBusyId(id);
    try {
      await mutateJson(`/admin/questions/${id}`, "DELETE");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="admin-card">
      <div className="admin-card-header">
        <h2>Ürün Soruları</h2>
        <div className="quick-actions">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={filter === f.value ? "admin-btn admin-btn-primary admin-btn-sm" : "admin-btn admin-btn-secondary admin-btn-sm"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {questions === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : questions.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-question-circle" />
          <h3>Bu filtrede soru yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q) => (
            <div key={q.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap", marginBottom: "0.5rem" }}>
                <div>
                  <a href={`/${q.productSlug}`} target="_blank" rel="noreferrer" style={{ color: "var(--admin-primary)", fontWeight: 700, fontSize: "0.85rem" }}>
                    {q.productName}
                  </a>
                  <div style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)", marginTop: 2 }}>
                    {q.customerName} · {q.vendorStoreName} · {new Date(q.createdAt).toLocaleDateString("tr-TR")}
                  </div>
                </div>
                <span className={`admin-badge admin-badge-${q.answer ? "active" : "pending"}`}>{q.answer ? "Cevaplandı" : "Bekliyor"}</span>
              </div>
              <p>{q.question}</p>
              {q.answer && (
                <p style={{ marginTop: 6, fontSize: "0.85rem", color: "var(--admin-text-muted)" }}>
                  <i className="fas fa-store" /> Satıcı yanıtı: {q.answer}
                </p>
              )}
              <button className="admin-btn admin-btn-danger admin-btn-sm" style={{ marginTop: "0.75rem" }} disabled={busyId === q.id} onClick={() => remove(q.id)}>
                Kaldır
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
