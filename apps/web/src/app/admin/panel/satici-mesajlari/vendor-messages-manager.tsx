"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminVendorsResponse, ThreadMessage, VendorConversation } from "@/lib/types";

export default function VendorMessagesManager() {
  const [conversations, setConversations] = useState<VendorConversation[] | null>(null);
  const [vendors, setVendors] = useState<AdminVendorsResponse["vendors"]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function loadConversations() {
    setConversations(await fetchJson<VendorConversation[]>("/admin/vendor-messages"));
  }

  useEffect(() => {
    loadConversations();
    fetchJson<AdminVendorsResponse>("/admin/vendors").then((r) => setVendors(r.vendors));
  }, []);

  async function openThread(vendorId: number) {
    setSelectedVendorId(vendorId);
    setThread(await fetchJson<ThreadMessage[]>(`/admin/vendor-messages/${vendorId}`));
    await loadConversations();
  }

  async function handleSend() {
    if (!selectedVendorId || !draft.trim()) return;
    setSending(true);
    try {
      await mutateJson(`/admin/vendor-messages/${selectedVendorId}`, "POST", { message: draft.trim() });
      setDraft("");
      setThread(await fetchJson<ThreadMessage[]>(`/admin/vendor-messages/${selectedVendorId}`));
      await loadConversations();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Satıcı Mesajları</h2>
        </div>
        <div className="admin-card-body" style={{ paddingBottom: 0 }}>
          <select className="admin-form-control" value={selectedVendorId ?? ""} onChange={(e) => e.target.value && openThread(Number(e.target.value))}>
            <option value="">Yeni konuşma başlat...</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.storeName}
              </option>
            ))}
          </select>
        </div>
        {conversations === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : conversations.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-envelope" />
            <h3>Henüz konuşma yok</h3>
          </div>
        ) : (
          <div style={{ padding: "8px 0" }}>
            {conversations.map((c) => (
              <a
                key={c.vendorId}
                href="#"
                onClick={(e) => { e.preventDefault(); openThread(c.vendorId); }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--admin-border)",
                  background: selectedVendorId === c.vendorId ? "var(--admin-surface-2)" : "transparent",
                }}
              >
                <div>
                  <strong>{c.vendorStoreName}</strong>
                  <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{c.lastMessage?.slice(0, 60)}</div>
                </div>
                {c.unreadCount > 0 && <span className="admin-badge admin-badge-pending">{c.unreadCount}</span>}
              </a>
            ))}
          </div>
        )}
      </div>

      {selectedVendorId && (
        <div className="admin-card">
          <div className="admin-card-header">
            <h2>{vendors.find((v) => v.id === selectedVendorId)?.storeName}</h2>
          </div>
          <div className="admin-card-body" style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
            {thread.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === "admin" ? "flex-end" : "flex-start",
                  background: m.sender === "admin" ? "var(--admin-primary)" : "var(--admin-surface-2)",
                  color: m.sender === "admin" ? "#fff" : "var(--admin-text)",
                  padding: "8px 14px",
                  borderRadius: 12,
                  maxWidth: "75%",
                }}
              >
                {m.message}
              </div>
            ))}
          </div>
          <div className="admin-card-body" style={{ display: "flex", gap: 8, paddingTop: 0 }}>
            <input
              className="admin-form-control"
              placeholder="Mesaj yaz..."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
            />
            <button className="admin-btn admin-btn-primary" disabled={sending} onClick={handleSend}>
              Gönder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
