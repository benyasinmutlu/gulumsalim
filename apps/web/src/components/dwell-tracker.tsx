"use client";

import { useEffect, useRef } from "react";
import { reportDwell } from "@/lib/client-api";

// bkz. kullanıcı isteği: "hangi üründe nerde kaç saniye duruldu" - ürün
// detay sayfasında geçirilen süre, sekme gizlenirken/sayfadan ayrılırken bir
// kez raporlanır (sendBeacon, bkz. client-api.ts reportDwell). Görünürlük
// kaybolup tekrar geri gelirse (ör. sekme değiştirme) süre birikmeye devam
// eder, sıfırlanmaz - sadece gerçekten sayfadan ayrılınca gönderilir.
export default function DwellTracker({ productId }: { productId: number }) {
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    startedAtRef.current = Date.now();

    function flush() {
      const now = Date.now();
      const ms = startedAtRef.current === null ? 0 : now - startedAtRef.current;
      startedAtRef.current = now;
      if (ms > 0) reportDwell(productId, ms);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [productId]);

  return null;
}
