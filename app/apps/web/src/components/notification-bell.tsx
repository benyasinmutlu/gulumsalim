"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson, mutateJson } from "../lib/client-api";
import type { CustomerNotification } from "../lib/types";

const POLL_MS = 30_000;

const TYPE_ICON: Record<string, string> = {
  order_shipped: "fa-truck",
  order_delivered: "fa-box-open",
  refund_approved: "fa-check-circle",
  refund_rejected: "fa-times-circle",
};

// Müşteri hesabı bildirim çanı - satıcı panelindeki bildirim rozeti/listesi
// (bkz. satici/panel/unread-badge.tsx + bildirimler/notifications-list.tsx)
// ile aynı desen, header'a sığacak açılır bir panel olarak.
// bkz. kullanıcı isteği: "bildirimler okunmuyor orayı da düzelt" - kök
// neden: <Link> tıklanınca Next.js navigasyonu HEMEN başlıyordu, "okundu
// işaretle" isteği (CSRF token alma + PATCH, iki ağ isteği) o navigasyon
// yüzünden yarıda kesiliyordu. Artık router.push MANUEL çağrılıyor, "okundu"
// isteği tamamlanana kadar beklenip SONRA yönlendiriliyor (bkz.
// satici/panel/bildirimler/notifications-list.tsx aynı düzeltme).
export default function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<CustomerNotification[] | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function loadCount() {
      fetchJson<{ count: number }>("/my/notifications/unread-count")
        .then((res) => {
          if (!cancelled) setCount(res.count);
        })
        .catch(() => {});
    }
    loadCount();
    const interval = setInterval(loadCount, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && notifications === null) {
      try {
        setNotifications(await fetchJson<CustomerNotification[]>("/my/notifications"));
      } catch {
        setNotifications([]);
      }
    }
  }

  async function markRead(id: number) {
    await mutateJson(`/my/notifications/${id}`, "PATCH");
    setNotifications((prev) => prev?.map((n) => (n.id === id ? { ...n, isRead: true } : n)) ?? null);
    setCount((c) => Math.max(0, c - 1));
  }

  async function markAllRead() {
    await mutateJson("/my/notifications/mark-all-read", "POST");
    setNotifications((prev) => prev?.map((n) => ({ ...n, isRead: true })) ?? null);
    setCount(0);
  }

  async function handleClick(n: CustomerNotification) {
    if (!n.isRead) await markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="header-notif-wrap" ref={wrapRef}>
      <button type="button" className="header-icon-labeled" aria-label="Bildirimler" onClick={toggleOpen}>
        <span className="header-icon-wrap">
          <i className="fas fa-bell" />
          {count > 0 && <span className="cart-badge">{count}</span>}
        </span>
        <span>Bildirimler</span>
      </button>

      {open && (
        <div className="header-notif-panel">
          <div className="header-notif-head">
            <h4>Bildirimler</h4>
            {count > 0 && (
              <button type="button" className="header-notif-mark-all" onClick={markAllRead}>
                Tümünü Okundu İşaretle
              </button>
            )}
          </div>
          <div className="header-notif-body">
            {notifications === null ? (
              <p className="header-notif-empty">Yükleniyor...</p>
            ) : notifications.length === 0 ? (
              <p className="header-notif-empty">Henüz bildirim yok.</p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`header-notif-item${n.isRead ? "" : " is-unread"}`}
                  onClick={() => handleClick(n)}
                  style={{ cursor: n.link || !n.isRead ? "pointer" : "default" }}
                >
                  <i className={`fas ${TYPE_ICON[n.type] ?? "fa-bell"}`} />
                  <div>
                    <strong>{n.title}</strong>
                    {n.message && <p>{n.message}</p>}
                    <span>{new Date(n.createdAt).toLocaleString("tr-TR")}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
