"use client";

import { useEffect, useState } from "react";

// bkz. follow-button.tsx - takip butonu "vendor-follow-changed" event'i
// yayınlar, burası onu dinleyip sayacı anında günceller (sayfa yenilemeden).
export default function FollowerCountStat({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    function onChange(e: Event) {
      const delta = (e as CustomEvent<{ delta: number }>).detail.delta;
      setCount((c) => Math.max(0, c + delta));
    }
    window.addEventListener("vendor-follow-changed", onChange);
    return () => window.removeEventListener("vendor-follow-changed", onChange);
  }, []);

  return <div className="val">{count}</div>;
}
