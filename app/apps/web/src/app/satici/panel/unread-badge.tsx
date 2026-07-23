"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "@/lib/client-api";

interface UnreadSummary {
  notifications: number;
  messages: number;
  pendingOrders: number;
}

const POLL_MS = 30_000;

// bkz. kullanıcı geri bildirimi: "bildirimler de de sıkıntı var" - rozet
// sadece panel açıldığında bir kez çekiliyordu, layout sayfa geçişlerinde
// yeniden mount olmadığı için bir bildirimi okusanız ya da yenisi gelse
// bile rozet oturum boyunca donuk kalıyordu. Artık her sayfa geçişinde ve
// 30 saniyede bir yenilenir.
export default function UnreadBadge({ kind }: { kind: keyof UnreadSummary }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchJson<UnreadSummary>("/vendor/unread-summary")
        .then((summary) => {
          if (!cancelled) setCount(summary[kind]);
        })
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [kind, pathname]);

  if (count === 0) return null;
  return <span className="badge-count">{count}</span>;
}
