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
      <div className="messages-layout">
        <div className="messages-list">
          {conversations === null ? (
            <p className="messages-list-empty">Yükleniyor...</p>
          ) : conversations.length === 0 && !hasVendorFromQuery ? (
            <p className="messages-list-empty">Henüz bir mağazayla mesajlaşmadınız.</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.vendorId}
                onClick={() => openThread(c.vendorId)}
                className={`messages-list-item${selectedVendorId === c.vendorId ? " active" : ""}`}
              >
                <div className="messages-list-item-info">
                  <strong>{c.vendorStoreName}</strong>
                  <div className="messages-list-item-preview">{c.lastMessage?.slice(0, 50)}</div>
                </div>
                <div className="messages-list-item-actions">
                  {c.unreadCount > 0 && <span className="messages-unread-badge">{c.unreadCount}</span>}
                  <button
                    type="button"
                    title="Konuşmayı sil"
                    aria-label="Konuşmayı sil"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(c.vendorId); }}
                    className="messages-delete-btn"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {selectedVendorId && (
          <div className="messages-thread">
            <div className="messages-thread-header">
              <span>{selectedConversation?.vendorStoreName ?? "Yeni mesaj"}</span>
              {selectedConversation && (
                <button type="button" className="btn btn-sec btn-sm" onClick={() => handleDeleteConversation(selectedVendorId!)}>
                  <i className="fas fa-trash" /> Konuşmayı Sil
                </button>
              )}
            </div>
            <div className="messages-thread-body">
              {thread.length === 0 ? (
                <p className="messages-thread-empty">Bu mağazaya ilk mesajınızı gönderin.</p>
              ) : (
                thread.map((m) => (
                  <div key={m.id} className={`messages-bubble ${m.sender === "customer" ? "customer" : "vendor"}`}>
                    {m.message}
                  </div>
                ))
              )}
            </div>
            <div className="messages-compose">
              <input
                className="form-control"
                placeholder="Mesaj yaz..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
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
