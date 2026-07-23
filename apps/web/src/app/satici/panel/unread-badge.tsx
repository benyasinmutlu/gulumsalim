"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";

interface UnreadSummary {
  notifications: number;
  messages: number;
  pendingOrders: number;
}

export default function UnreadBadge({ kind }: { kind: keyof UnreadSummary }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetchJson<UnreadSummary>("/vendor/unread-summary")
      .then((summary) => setCount(summary[kind]))
      .catch(() => {});
  }, [kind]);

  if (count === 0) return null;
  return <span className="badge-count">{count}</span>;
}
