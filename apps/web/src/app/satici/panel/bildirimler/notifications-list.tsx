"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorNotification } from "@/lib/types";

const TYPE_ICON: Record<string, string> = {
  new_order: "fa-shopping-bag",
  new_question: "fa-question-circle",
  admin_message: "fa-envelope",
};

// bkz. kullanıcı isteği: "bildirimler okunmuyor orayı da düzelt" - kök
// neden: <Link> tıklanınca Next.js navigasyonu HEMEN başlıyordu, "okundu
// işaretle" isteği (CSRF token alma + PATCH, iki ağ isteği) o navigasyon
// yüzünden yarıda kesiliyordu - çoğu bildirim linke sahip olduğu için
// (sipariş/soru bildirimleri) neredeyse hiçbiri gerçekten okundu
// işaretlenmiyordu. Artık navigasyon router.push ile MANUEL yapılıyor,
// "okundu" isteği tamamlanana kadar beklenip SONRA yönlendiriliyor.
export default function NotificationsList() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<VendorNotification[] | null>(null);

  async function load() {
    setNotifications(await fetchJson<VendorNotification[]>("/vendor/notifications"));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: number) {
    await mutateJson(`/vendor/notifications/${id}`, "PATCH");
    await load();
  }

  async function markAllRead() {
    await mutateJson("/vendor/notifications/mark-all-read", "POST");
    await load();
  }

  async function handleClick(n: VendorNotification) {
    if (!n.isRead) await markRead(n.id);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Bildirimler</h3>
        <button className="btn btn-sec btn-sm" onClick={markAllRead}>
          Tümünü Okundu İşaretle
        </button>
      </div>
      {notifications === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : notifications.length === 0 ? (
        <div className="empty">
          <i className="fas fa-bell" />
          <p>Henüz bildirim yok.</p>
        </div>
      ) : (
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {notifications.map((n) => {
            const content = (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 14px",
                  background: n.isRead ? "transparent" : "var(--pr-light)",
                  borderRadius: 10,
                  border: "1px solid var(--br)",
                }}
              >
                <i className={`fas ${TYPE_ICON[n.type] ?? "fa-bell"}`} style={{ color: "var(--pr)", marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: 13 }}>{n.title}</strong>
                  {n.message && <p style={{ fontSize: 12.5, color: "var(--tx2)" }}>{n.message}</p>}
                  <span style={{ fontSize: 11, color: "var(--tx3)" }}>{new Date(n.createdAt).toLocaleString("tr-TR")}</span>
                </div>
              </div>
            );
            return (
              <div key={n.id} onClick={() => handleClick(n)} style={{ cursor: n.link || !n.isRead ? "pointer" : "default" }}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
