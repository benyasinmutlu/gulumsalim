"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trackContentDwell, trackContentView } from "@/lib/client-api";

// bkz. kullanıcı isteği: "anasayfada listelenen bölümlerde müşteri kaç
// saniye kalıyor" - promo-banner-impression.tsx'teki IntersectionObserver
// deseniyle görüntülenme (%50 ekrana girince, tek seferlik) + dwell-tracker.tsx'teki
// visibilitychange/pagehide deseniyle EKRANDA GÖRÜNÜR OLDUĞU sürenin
// birikmesi (sayfanın tamamı değil, sadece bu bölüm görünürken).
export default function SectionAnalyticsTracker({ sectionId, children }: { sectionId: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const visibleSinceRef = useRef<number | null>(null);
  const accumulatedMsRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function flush() {
      if (visibleSinceRef.current !== null) {
        accumulatedMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = null;
      }
      if (accumulatedMsRef.current > 0) {
        trackContentDwell("homepage_section", sectionId, accumulatedMsRef.current);
        accumulatedMsRef.current = 0;
      }
    }

    let viewedOnce = false;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (!viewedOnce) {
              viewedOnce = true;
              trackContentView("homepage_section", sectionId);
            }
            visibleSinceRef.current = Date.now();
          } else if (visibleSinceRef.current !== null) {
            accumulatedMsRef.current += Date.now() - visibleSinceRef.current;
            visibleSinceRef.current = null;
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);

    return () => {
      flush();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, [sectionId]);

  return <div ref={ref}>{children}</div>;
}
