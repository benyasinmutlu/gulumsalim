"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

interface UnreadSummary {
  pendingOrders: number;
  pendingVendors: number;
  unreadVendorMessages: number;
  unreadContactMessages: number;
  pendingPayouts: number;
  pendingReviews: number;
}

export default function AdminUnreadBadge({ kind }: { kind: keyof UnreadSummary }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchJson<UnreadSummary>("/admin/unread-summary")
      .then((summary) => setCount(summary[kind]))
      .catch(() => {});
  }, [kind]);

  if (count === 0) return null;
  return <span className="badge-count">{count}</span>;
}
