"use client";

import { useEffect, useRef, type ReactNode } from "react";

// homepage-sections.php'deki anim_style seçeneklerinin (fade-up/zoom-in/
// slide-left/fade) karşılığı - eski sitede AOS benzeri bir kütüphane
// kullanılıyordu, burada aynı görsel sonucu tek bir IntersectionObserver ile
// üretiyoruz.
export default function ScrollReveal({ anim = "fade-up", children }: { anim?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="section-reveal" data-anim={anim}>
      {children}
    </div>
  );
}
