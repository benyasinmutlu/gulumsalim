"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { CustomerSideVendorConversation, CustomerThreadMessage } from "@/lib/types";

export default function MessagesClient() {
  const searchParams = useSearchParams();
  const initialVendorId = searchParams.get("vendorId");

  const [conversations, setConversations] = useState<CustomerSideVendorConversation[] | null>(null);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(initialVendorId ? Number(initialVendorId) : null);
  const [thread, setThread] = useState<CustomerThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function loadConversations() {
    const rows = await fetchJson<CustomerSideVendorConversation[]>("/my/vendor-messages");
    setConversations(rows);
    return rows;
  }

  useEffect(() => {
    loadConversations().then((rows) => {
      if (selectedVendorId) openThread(selectedVendorId);
      else if (rows.length > 0) openThread(rows[0].vendorId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openThread(vendorId: number) {
    setSelectedVendorId(vendorId);
    setThread(await fetchJson<CustomerThreadMessage[]>(`/my/vendor-messages/${vendorId}`));
    await loadConversations();
  }

  async function handleSend() {
    if (!selectedVendorId || !draft.trim()) return;
    setSending(true);
    try {
      await mutateJson(`/my/vendor-messages/${selectedVendorId}`, "POST", { message: draft.trim() });
      setDraft("");
      setThread(await fetchJson<CustomerThreadMessage[]>(`/my/vendor-messages/${selectedVendorId}`));
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  // bkz. kullanıcı isteği: "buradaki mesajlar silinebilsin" - satıcıyla
  // olan tüm konuşma silinir.
  async function handleDeleteConversation(vendorId: number) {
    if (!window.confirm("Bu konuşmayı silmek istediğinize emin misiniz?")) return;
    await mutateJson(`/my/vendor-messages/${vendorId}`, "DELETE");
    if (selectedVendorId === vendorId) {
      setSelectedVendorId(null);
      setThread([]);
    }
    await loadConversations();
  }

  const selectedConversation = conversations?.find((c) => c.vendorId === selectedVendorId);
  const hasVendorFromQuery = initialVendorId && !conversations?.some((c) => c.vendorId === Number(initialVendorId));

  return (
    <div className="form-card">
      <h3>Mesajlarım</h3>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 16 }}>
        <div style={{ flex: "1 1 260px", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
          {conversations === null ? (
            <p style={{ padding: 16, fontSize: "0.9rem" }}>Yükleniyor...</p>
          ) : conversations.length === 0 && !hasVendorFromQuery ? (
            <p style={{ padding: 16, fontSize: "0.9rem" }}>Henüz bir mağazayla mesajlaşmadınız.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.vendorId}
                onClick={() => openThread(c.vendorId)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--color-border-light)",
                  background: selectedVendorId === c.vendorId ? "var(--color-bg-alt)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong>{c.vendorStoreName}</strong>
                  <div style={{ fontSize: 12, color: "var(--color-text-light)" }}>{c.lastMessage?.slice(0, 50)}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {c.unreadCount > 0 && (
                    <span style={{ background: "var(--color-primary)", color: "#fff", borderRadius: 10, fontSize: 11, padding: "2px 7px", height: "fit-content" }}>
                      {c.unreadCount}
                    </span>
                  )}
                  <button
                    type="button"
                    title="Konuşmayı sil"
                    aria-label="Konuşmayı sil"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.vendorId); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-light)", padding: 4 }}
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedVendorId && (
          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", border: "1px solid var(--color-border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border-light)", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{selectedConversation?.vendorStoreName ?? "Yeni mesaj"}</span>
              {selectedConversation && (
                <button
                  type="button"
                  className="btn btn-sec btn-sm"
                  onClick={() => handleDeleteConversation(selectedVendorId!)}
                  style={{ fontWeight: 400, fontSize: 12 }}
                >
                  <i className="fas fa-trash" /> Konuşmayı Sil
                </button>
              )}
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, padding: 16, minHeight: 200, maxHeight: 360, overflowY: "auto" }}>
              {thread.length === 0 ? (
                <p style={{ fontSize: "0.85rem", color: "var(--color-text-light)" }}>Bu mağazaya ilk mesajınızı gönderin.</p>
              ) : (
                thread.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: m.sender === "customer" ? "flex-end" : "flex-start",
                      background: m.sender === "customer" ? "var(--color-primary)" : "var(--color-bg-alt)",
                      color: m.sender === "customer" ? "#fff" : "var(--color-text)",
                      padding: "8px 14px",
                      borderRadius: 12,
                      maxWidth: "80%",
                    }}
                  >
                    {m.message}
                  </div>
                ))
              )}
            </div>
            <div style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--color-border-light)" }}>
              <input
                className="form-control"
                placeholder="Mesaj yaz..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" disabled={sending} onClick={handleSend}>
                Gönder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
