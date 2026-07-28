"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJson } from "@/lib/client-api";

interface UnreadSummary {
  pendingOrders: number;
  pendingVendors: number;
  unreadVendorMessages: number;
  unreadContactMessages: number;
  pendingPayouts: number;
  pendingReviews: number;
  pendingBanners: number;
  pendingComplaints: number;
  unreadSiteFeedback: number;
}

const POLL_MS = 30_000;

// bkz. satici/panel/unread-badge.tsx - aynı donuk rozet sorunu admin
// tarafında da vardı, her sayfa geçişinde ve 30 saniyede bir yenilenir.
export default function AdminUnreadBadge({ kind }: { kind: keyof UnreadSummary }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetchJson<UnreadSummary>("/admin/unread-summary")
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
