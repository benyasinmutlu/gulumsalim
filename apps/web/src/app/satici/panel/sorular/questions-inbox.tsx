"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorQuestion } from "@/lib/types";

export default function QuestionsInbox() {
  const [questions, setQuestions] = useState<VendorQuestion[] | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setQuestions(await fetchJson<VendorQuestion[]>("/vendor/questions"));
  }

  useEffect(() => {
    load();
  }, []);

  async function answer(id: number) {
    const answer = (drafts[id] ?? "").trim();
    if (!answer) return;
    setBusyId(id);
    try {
      await mutateJson(`/vendor/questions/${id}`, "PATCH", { answer });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Ürün Soruları</h3>
      </div>
      {questions === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : questions.length === 0 ? (
        <div className="empty">
          <i className="fas fa-question-circle" />
          <p>Henüz gelen soru yok.</p>
        </div>
      ) : (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {questions.map((q) => (
            <div key={q.id} style={{ background: "var(--bg)", border: "1px solid var(--br)", borderRadius: "var(--radius)", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong>
                  {q.customerName} · <span style={{ fontWeight: 400, color: "var(--tx3)" }}>{q.productName}</span>
                </strong>
                <span style={{ fontSize: "12px", color: "var(--tx3)" }}>{new Date(q.createdAt).toLocaleDateString("tr-TR")}</span>
              </div>
              <p>{q.question}</p>

              {q.answer ? (
                <div style={{ marginTop: "10px", padding: "10px 12px", background: "var(--s2)", borderRadius: "8px", fontSize: "13px" }}>
                  <strong>
                    <i className="fas fa-store" /> Cevabınız:
                  </strong>
                  <p>{q.answer}</p>
                </div>
              ) : (
                <div style={{ marginTop: "0.75rem" }}>
                  <textarea
                    className="fi"
                    rows={2}
                    placeholder="Cevabınızı yazın..."
                    value={drafts[q.id] ?? ""}
                    onChange={(e) => setDrafts((d) => ({ ...d, [q.id]: e.target.value }))}
                  />
                  <button className="btn btn-pr btn-sm" style={{ marginTop: "8px" }} onClick={() => answer(q.id)} disabled={busyId === q.id}>
                    {busyId === q.id ? "Gönderiliyor..." : "Cevapla"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
