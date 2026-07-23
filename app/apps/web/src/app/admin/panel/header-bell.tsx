"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/client-api";

interface UnreadSummary {
  pendingOrders: number;
}

// boot.php'deki topbar bildirim zilinin (.topbar-btn + .notif-dot,
// "X yeni" bekleyen sipariş sayısı) karşılığı - önceki halde header'da
// hiçbir bildirim göstergesi yoktu, sadece sidebar rozetinde vardı.
const POLL_MS = 30_000;

export default function AdminHeaderBell() {
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchJson<UnreadSummary>("/admin/unread-summary")
        .then((summary) => {
          if (!cancelled) setPendingOrders(summary.pendingOrders);
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <Link href="/admin/panel/siparisler" className="admin-header-btn" title="Bekleyen siparişler">
      <i className="fas fa-bell" />
      {pendingOrders > 0 && <span className="header-badge" />}
    </Link>
  );
}
