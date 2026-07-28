"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { ContactMessage } from "@/lib/types";

export default function ContactMessagesManager() {
  const [messages, setMessages] = useState<ContactMessage[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  async function load() {
    setMessages(await fetchJson<ContactMessage[]>("/admin/contact-messages"));
  }

  useEffect(() => {
    load();
  }, []);

  async function openMessage(m: ContactMessage) {
    setActiveId(m.id);
    if (!m.isRead) {
      await mutateJson(`/admin/contact-messages/${m.id}`, "PATCH");
      await load();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    await mutateJson(`/admin/contact-messages/${id}`, "DELETE");
    if (activeId === id) setActiveId(null);
    await load();
  }

  const activeMsg = messages?.find((m) => m.id === activeId) ?? null;

  return (
    <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", minHeight: 560 }}>
        <div style={{ borderRight: "1px solid var(--admin-border)", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--admin-border)", fontWeight: 700, fontSize: 14 }}>
            <i className="fas fa-envelope" style={{ color: "var(--admin-primary)" }} /> İletişim Formu Mesajları
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {messages === null ? (
              <div style={{ padding: 20 }}>Yükleniyor...</div>
            ) : messages.length === 0 ? (
              <div className="admin-empty" style={{ padding: "40px 20px" }}>
                <i className="fas fa-envelope-open" />
                <h3>Henüz mesaj yok</h3>
              </div>
            ) : (
              messages.map((m) => (
                <a
                  key={m.id}
                  href="#"
                  onClick={(e) => { e.preventDefault(); openMessage(m); }}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "14px 16px",
                    borderBottom: "1px solid var(--admin-border)",
                    background: activeId === m.id ? "var(--admin-surface-2)" : "transparent",
                    borderLeft: activeId === m.id ? "3px solid var(--admin-primary)" : "3px solid transparent",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, var(--admin-primary), var(--admin-accent))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 14,
                      color: "#fff",
                      flexShrink: 0,
                    }}
                  >
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ fontWeight: m.isRead ? 500 : 700, fontSize: 13 }}>{m.name}</div>
                      {!m.isRead && <span className="header-badge" style={{ position: "static" }} />}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>
                      {m.message.slice(0, 50)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--admin-text-muted)", marginTop: 2 }}>
                      {new Date(m.createdAt).toLocaleDateString("tr-TR")}
                    </div>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {activeMsg ? (
            <>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--admin-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "linear-gradient(135deg, var(--admin-primary), var(--admin-accent))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: 16,
                      color: "#fff",
                    }}
                  >
                    {activeMsg.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700 }}>{activeMsg.name}</div>
                    <div style={{ fontSize: 12, color: "var(--admin-text-muted)" }}>{activeMsg.email}</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <a className="admin-btn admin-btn-secondary admin-btn-sm" href={`mailto:${activeMsg.email}`}>
                    <i className="fas fa-reply" /> Yanıtla
                  </a>
                  <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(activeMsg.id)}>
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </div>
              <div style={{ padding: 24, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{activeMsg.message}</div>
            </>
          ) : (
            <div className="admin-empty" style={{ margin: "auto" }}>
              <i className="fas fa-envelope-open-text" />
              <h3>Görüntülemek için bir mesaj seçin</h3>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
