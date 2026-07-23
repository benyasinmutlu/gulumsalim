"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminQuestionRow } from "@/lib/types";

export default function QuestionsModeration() {
  const [questions, setQuestions] = useState<AdminQuestionRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setQuestions(await fetchJson<AdminQuestionRow[]>("/admin/questions"));
  }

  useEffect(() => {
    load();
  }, []);

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
      </div>
      {questions === null ? (
        <div className="admin-card-body">Yükleniyor...</div>
      ) : questions.length === 0 ? (
        <div className="admin-empty">
          <i className="fas fa-question-circle" />
          <h3>Henüz soru yok</h3>
        </div>
      ) : (
        <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q) => (
            <div key={q.id} style={{ background: "var(--admin-bg)", border: "1px solid var(--admin-border)", borderRadius: "var(--admin-radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>
                  {q.customerName} · <span style={{ fontWeight: 400, color: "var(--admin-text-muted)" }}>{q.productName}</span>
                </strong>
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
