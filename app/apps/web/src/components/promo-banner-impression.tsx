"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { trackPromoBannerView } from "@/lib/client-api";

// bkz. kullanıcı isteği: "kampanyalarına kaç kişi baktı" - banner en az
// %50 oranında ekrana girdiğinde bir kere görüntülenme kaydı atar (bkz.
// scroll-reveal.tsx'teki aynı IntersectionObserver deseni).
export default function PromoBannerImpression({ bannerId, children }: { bannerId: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            trackPromoBannerView(bannerId);
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [bannerId]);

  return <div ref={ref}>{children}</div>;
}
