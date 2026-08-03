"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { CustomerThreadMessage, VendorSideCustomerConversation } from "@/lib/types";
import { CATEGORY_META, classifyMessage, REPLY_TEMPLATES, type MessageCategory } from "@/lib/message-moderation";

type FilterKey = "all" | "complaint" | "question" | "flagged";

const FILTERS: [FilterKey, string][] = [
  ["all", "Tümü"],
  ["complaint", "Şikayet"],
  ["question", "Soru"],
  ["flagged", "İşaretli"],
];

function StatMini({ label, value, tone }: { label: string; value: number; tone?: "warn" | "danger" }) {
  const color = tone === "danger" ? "var(--er)" : tone === "warn" ? "var(--wa)" : "var(--tx)";
  return (
    <div className="stat-card">
      <div className="sc-label">{label}</div>
      <div className="sc-val" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export default function CustomerMessages() {
  const [conversations, setConversations] = useState<VendorSideCustomerConversation[] | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [thread, setThread] = useState<CustomerThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  async function loadConversations() {
    setConversations(await fetchJson<VendorSideCustomerConversation[]>("/vendor/customer-messages"));
  }

  useEffect(() => {
    loadConversations();
  }, []);

  async function openThread(customerId: number) {
    setSelectedCustomerId(customerId);
    setThread(await fetchJson<CustomerThreadMessage[]>(`/vendor/customer-messages/${customerId}`));
    await loadConversations();
  }

  async function handleSend() {
    if (!selectedCustomerId || !draft.trim()) return;
    setSending(true);
    try {
      await mutateJson(`/vendor/customer-messages/${selectedCustomerId}`, "POST", { message: draft.trim() });
      setDraft("");
      setThread(await fetchJson<CustomerThreadMessage[]>(`/vendor/customer-messages/${selectedCustomerId}`));
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  // Her konuşmanın son mesajını sınıflandır (rozet + filtre + analytics için).
  const categoryByCustomer = useMemo(() => {
    const map = new Map<number, MessageCategory>();
    for (const c of conversations ?? []) {
      map.set(c.customerId, c.lastMessage ? classifyMessage(c.lastMessage).category : "normal");
    }
    return map;
  }, [conversations]);

  const stats = useMemo(() => {
    const list = conversations ?? [];
    let complaint = 0;
    let question = 0;
    let flagged = 0;
    let unread = 0;
    for (const c of list) {
      const cat = categoryByCustomer.get(c.customerId) ?? "normal";
      if (cat === "complaint") complaint++;
      if (cat === "question") question++;
      if (cat === "abuse" || cat === "spam") flagged++;
      unread += c.unreadCount;
    }
    return { total: list.length, complaint, question, flagged, unread };
  }, [conversations, categoryByCustomer]);

  const visibleConversations = useMemo(() => {
    const list = conversations ?? [];
    if (filter === "all") return list;
    return list.filter((c) => {
      const cat = categoryByCustomer.get(c.customerId) ?? "normal";
      if (filter === "complaint") return cat === "complaint";
      if (filter === "question") return cat === "question";
      return cat === "abuse" || cat === "spam"; // flagged
    });
  }, [conversations, categoryByCustomer, filter]);

  const selectedConversation = conversations?.find((c) => c.customerId === selectedCustomerId);

  return (
    <div>
      {conversations && conversations.length > 0 && (
        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <StatMini label="Toplam Konuşma" value={stats.total} />
          <StatMini label="Okunmamış" value={stats.unread} />
          <StatMini label="Şikayet" value={stats.complaint} tone="warn" />
          <StatMini label="İşaretli (küfür/spam)" value={stats.flagged} tone="danger" />
        </div>
      )}

      <div className="fc" style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
        <div className="card" style={{ flex: "1 1 340px" }}>
          <div className="ch" style={{ flexWrap: "wrap", gap: 6 }}>
            <h3>Müşteri Mesajları</h3>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {FILTERS.map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  className={`btn btn-sm ${filter === k ? "btn-pr" : "btn-sec"}`}
                  onClick={() => setFilter(k)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {conversations === null ? (
            <div className="card-body">Yükleniyor...</div>
          ) : visibleConversations.length === 0 ? (
            <div className="card-body">
              <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>
                {conversations.length === 0 ? "Henüz müşteri mesajı yok." : "Bu filtrede konuşma yok."}
              </p>
            </div>
          ) : (
            <div>
              {visibleConversations.map((c) => {
                const cat = categoryByCustomer.get(c.customerId) ?? "normal";
                const meta = CATEGORY_META[cat];
                const preview = c.lastMessage ? classifyMessage(c.lastMessage).maskedText.slice(0, 60) : "";
                return (
                  <a
                    key={c.customerId}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openThread(c.customerId);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--br)",
                      background: selectedCustomerId === c.customerId ? "var(--s2)" : "transparent",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong>{c.customerName}</strong>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--tx3)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 220,
                        }}
                      >
                        {preview}
                      </div>
                      {cat !== "normal" && (
                        <span className={`st ${meta.cls}`} style={{ marginTop: 4 }}>
                          <i className={`fas ${meta.icon}`} /> {meta.label}
                        </span>
                      )}
                    </div>
                    {c.unreadCount > 0 && <span className="badge-count">{c.unreadCount}</span>}
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {selectedCustomerId && (
          <div className="card" style={{ flex: "1 1 340px" }}>
            <div className="ch">
              <h3>{selectedConversation?.customerName}</h3>
            </div>
            <div
              className="card-body"
              style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}
            >
              {thread.map((m) => {
                const cls = m.sender === "customer" ? classifyMessage(m.message) : null;
                return (
                  <div key={m.id} style={{ alignSelf: m.sender === "vendor" ? "flex-end" : "flex-start", maxWidth: "78%" }}>
                    <div
                      style={{
                        background: m.sender === "vendor" ? "var(--pr)" : "var(--s2)",
                        color: m.sender === "vendor" ? "#fff" : "var(--tx)",
                        padding: "8px 14px",
                        borderRadius: 12,
                      }}
                    >
                      {cls ? cls.maskedText : m.message}
                    </div>
                    {cls && cls.category !== "normal" && (
                      <span className={`st ${CATEGORY_META[cls.category].cls}`} style={{ marginTop: 4 }}>
                        <i className={`fas ${CATEGORY_META[cls.category].icon}`} /> {CATEGORY_META[cls.category].label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              className="card-body"
              style={{ paddingTop: 0, paddingBottom: 8, display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              <span style={{ fontSize: 11, color: "var(--tx3)", alignSelf: "center" }}>Hazır cevap:</span>
              {REPLY_TEMPLATES.map((t) => (
                <button key={t.label} type="button" className="btn btn-sec btn-sm" onClick={() => setDraft(t.text)} title={t.text}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="card-body" style={{ display: "flex", gap: 8, paddingTop: 0 }}>
              <input
                className="fi"
                placeholder="Mesaj yaz..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button className="btn btn-pr" disabled={sending} onClick={handleSend}>
                Gönder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
