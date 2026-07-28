"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminVendorsResponse, ThreadMessage, VendorConversation } from "@/lib/types";

function initials(name: string) {
  return name.charAt(0).toUpperCase();
}

export default function VendorMessagesManager() {
  const [conversations, setConversations] = useState<VendorConversation[] | null>(null);
  const [vendors, setVendors] = useState<AdminVendorsResponse["vendors"]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const threadRef = useRef<HTMLDivElement>(null);

  async function loadConversations() {
    setConversations(await fetchJson<VendorConversation[]>("/admin/vendor-messages"));
  }

  useEffect(() => {
    loadConversations();
    fetchJson<AdminVendorsResponse>("/admin/vendors").then((r) => setVendors(r.vendors));
  }, []);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [thread]);

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

  async function handleDeleteThread(vendorId: number, storeName: string) {
    if (!confirm(`${storeName} ile olan tüm yazışma silinsin mi? Bu işlem geri alınamaz.`)) return;
    await mutateJson(`/admin/vendor-messages/${vendorId}`, "DELETE");
    if (selectedVendorId === vendorId) {
      setSelectedVendorId(null);
      setThread([]);
    }
    await loadConversations();
  }

  const filteredConversations = useMemo(() => {
    if (!conversations) return null;
    const q = search.trim().toLocaleLowerCase("tr-TR");
    if (!q) return conversations;
    return conversations.filter((c) => c.vendorStoreName.toLocaleLowerCase("tr-TR").includes(q));
  }, [conversations, search]);

  const activeVendor = vendors.find((v) => v.id === selectedVendorId);
  const totalUnread = conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;

  let lastDay: string | null = null;

  return (
    <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 560 }}>
        <div style={{ borderRight: "1px solid var(--admin-border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-border)" }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <i className="fas fa-comments" style={{ color: "var(--admin-primary)" }} /> Satıcı Konuşmaları
              {totalUnread > 0 && <span className="header-badge" style={{ position: "static" }} />}
            </h2>
            <input
              className="admin-form-control"
              placeholder="Mağaza ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="admin-form-control" style={{ marginTop: 8 }} value="" onChange={(e) => e.target.value && openThread(Number(e.target.value))}>
              <option value="">Yeni konuşma başlat...</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.storeName}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filteredConversations === null ? (
              <div style={{ padding: 20 }}>Yükleniyor...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="admin-empty" style={{ padding: "40px 20px" }}>
                <i className="fas fa-envelope-open" />
                <h3>{search ? "Sonuç bulunamadı" : "Henüz konuşma yok"}</h3>
              </div>
            ) : (
              filteredConversations.map((c) => (
                <div key={c.vendorId} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--admin-border)", background: selectedVendorId === c.vendorId ? "var(--admin-primary-light)" : "transparent", borderLeft: selectedVendorId === c.vendorId ? "3px solid var(--admin-primary)" : "3px solid transparent" }}>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); openThread(c.vendorId); }}
                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "14px 18px", flex: 1, minWidth: 0 }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 11, background: "linear-gradient(135deg, var(--admin-primary), var(--admin-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color: "#fff", flexShrink: 0, overflow: "hidden" }}>
                      {c.vendorLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.vendorLogo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        initials(c.vendorStoreName)
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.vendorStoreName}</div>
                        <div style={{ fontSize: 10, color: "var(--admin-text-muted)", flexShrink: 0 }}>
                          {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString("tr-TR") : ""}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6, justifyContent: "space-between" }}>
                        <div style={{ fontSize: 12, color: c.unreadCount > 0 ? "var(--admin-text)" : "var(--admin-text-muted)", fontWeight: c.unreadCount > 0 ? 600 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {c.lastSender === "admin" ? "Siz: " : ""}{(c.lastMessage ?? "").slice(0, 42)}
                        </div>
                        {c.unreadCount > 0 && (
                          <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--admin-primary)", flexShrink: 0, marginTop: 5 }} />
                        )}
                      </div>
                    </div>
                  </a>
                  <div style={{ display: "flex", alignItems: "center", padding: "0 12px" }}>
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(c.vendorId, c.vendorStoreName)}
                      title="Konuşmayı Sil"
                      style={{ width: 28, height: 28, border: "none", background: "transparent", color: "var(--admin-text-muted)", cursor: "pointer", borderRadius: 8, fontSize: 12 }}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {selectedVendorId && activeVendor ? (
            <>
              <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--admin-border)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg, var(--admin-primary), var(--admin-accent))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: "#fff", overflow: "hidden" }}>
                  {initials(activeVendor.storeName)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{activeVendor.storeName}</div>
                  <a href={`/${activeVendor.storeSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--admin-text-muted)" }}>
                    Mağazayı gör <i className="fas fa-external-link-alt" />
                  </a>
                </div>
                <button className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => handleDeleteThread(activeVendor.id, activeVendor.storeName)}>
                  <i className="fas fa-trash" /> Sil
                </button>
              </div>

              <div ref={threadRef} style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", minHeight: 420, maxHeight: 520, background: "var(--admin-bg)" }}>
                {thread.map((m) => {
                  const day = new Date(m.createdAt).toDateString();
                  const showDaySep = day !== lastDay;
                  lastDay = day;
                  const isAdmin = m.sender === "admin";
                  return (
                    <div key={m.id}>
                      {showDaySep && (
                        <div style={{ textAlign: "center", fontSize: 11, color: "var(--admin-text-muted)", margin: "14px 0 6px" }}>
                          {new Date(m.createdAt).toLocaleDateString("tr-TR")}
                        </div>
                      )}
                      <div style={{ display: "flex", marginBottom: 2, justifyContent: isAdmin ? "flex-end" : "flex-start" }}>
                        <div
                          style={{
                            maxWidth: "68%",
                            padding: "11px 15px",
                            fontSize: 13,
                            lineHeight: 1.55,
                            background: isAdmin ? "linear-gradient(135deg, var(--admin-primary), #c030d0)" : "var(--admin-surface-2)",
                            color: isAdmin ? "#fff" : "var(--admin-text)",
                            border: isAdmin ? "none" : "1px solid var(--admin-border)",
                            borderRadius: isAdmin ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          }}
                        >
                          {!isAdmin && (
                            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--admin-primary)", marginBottom: 4 }}>
                              <i className="fas fa-store" /> {activeVendor.storeName}
                            </div>
                          )}
                          <div style={{ whiteSpace: "pre-wrap" }}>{m.message}</div>
                          <div style={{ fontSize: 10, color: isAdmin ? "rgba(255,255,255,.75)" : "var(--admin-text-muted)", marginTop: 6, textAlign: "right" }}>
                            {new Date(m.createdAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                            {isAdmin && (
                              <i className={`fas ${m.isRead ? "fa-check-double" : "fa-check"}`} style={{ marginLeft: 4 }} title={m.isRead ? "Satıcı okudu" : "İletildi"} />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: "16px 22px", borderTop: "1px solid var(--admin-border)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <textarea
                    className="admin-form-control"
                    style={{ flex: 1, resize: "none", minHeight: 46, maxHeight: 120 }}
                    rows={2}
                    placeholder="Satıcıya yanıt yazın..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button className="admin-btn admin-btn-primary" disabled={sending} onClick={handleSend} style={{ height: 46, whiteSpace: "nowrap" }}>
                    <i className="fas fa-paper-plane" /> Gönder
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="admin-empty" style={{ margin: "auto", textAlign: "center" }}>
              <i className="fas fa-comments" style={{ fontSize: 56, opacity: 0.2, marginBottom: 16 }} />
              <h3>Bir konuşma seçin</h3>
              <p style={{ fontSize: 12 }}>Soldaki listeden bir satıcı seçerek mesajlaşmaya başlayın</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
