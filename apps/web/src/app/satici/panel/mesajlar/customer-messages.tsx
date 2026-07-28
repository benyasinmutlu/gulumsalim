"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { CustomerThreadMessage, VendorSideCustomerConversation } from "@/lib/types";

export default function CustomerMessages() {
  const [conversations, setConversations] = useState<VendorSideCustomerConversation[] | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [thread, setThread] = useState<CustomerThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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

  const selectedConversation = conversations?.find((c) => c.customerId === selectedCustomerId);

  return (
    <div className="fc" style={{ flexDirection: "row", gap: 20, flexWrap: "wrap" }}>
      <div className="card" style={{ flex: "1 1 320px" }}>
        <div className="ch">
          <h3>Müşteri Mesajları</h3>
        </div>
        {conversations === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : conversations.length === 0 ? (
          <div className="card-body">
            <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Henüz müşteri mesajı yok.</p>
          </div>
        ) : (
          <div>
            {conversations.map((c) => (
              <a
                key={c.customerId}
                href="#"
                onClick={(e) => { e.preventDefault(); openThread(c.customerId); }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--br)",
                  background: selectedCustomerId === c.customerId ? "var(--s2)" : "transparent",
                }}
              >
                <div>
                  <strong>{c.customerName}</strong>
                  <div style={{ fontSize: 12, color: "var(--tx3)" }}>{c.lastMessage?.slice(0, 60)}</div>
                </div>
                {c.unreadCount > 0 && <span className="badge-count">{c.unreadCount}</span>}
              </a>
            ))}
          </div>
        )}
      </div>

      {selectedCustomerId && (
        <div className="card" style={{ flex: "1 1 320px" }}>
          <div className="ch">
            <h3>{selectedConversation?.customerName}</h3>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
            {thread.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "vendor" ? "flex-end" : "flex-start",
                  background: m.sender === "vendor" ? "var(--pr)" : "var(--s2)",
                  color: m.sender === "vendor" ? "#fff" : "var(--tx)",
                  padding: "8px 14px",
                  borderRadius: 12,
                  maxWidth: "75%",
                }}
              >
                {m.message}
              </div>
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
  );
}
