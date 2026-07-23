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
export default function AdminHeaderBell() {
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    fetchJson<UnreadSummary>("/admin/unread-summary")
      .then((summary) => setPendingOrders(summary.pendingOrders))
      .catch(() => {});
  }, []);

  return (
    <Link href="/admin/panel/siparisler" className="admin-header-btn" title="Bekleyen siparişler">
      <i className="fas fa-bell" />
      {pendingOrders > 0 && <span className="header-badge" />}
    </Link>
  );
}
