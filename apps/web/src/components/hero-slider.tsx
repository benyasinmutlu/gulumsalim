"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { AdminSlider } from "../lib/types";

const ALIGN: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

// gulumsalim.com'daki hero slider'ın birebir karşılığı: otomatik geçiş,
// ok/nokta navigasyon + dokunmatik kaydırma, her slaytın kendi başlık/alt
// başlık/buton/metin rengi/metin konumu. SEO/erişilebilirlik gereği sayfada
// tek bir <h1> olsun diye sadece İLK slaytın başlığı gerçek <h1>, diğerleri
// aynı görsel stille <div> olarak render edilir.
export default function HeroSlider({ slides, intervalMs = 6000 }: { slides: AdminSlider[]; intervalMs?: number }) {
  const [current, setCurrent] = useState(0);
  const touchStartX = useRef(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  if (slides.length === 0) return null;

  function goTo(n: number) {
    setCurrent((n + slides.length) % slides.length);
  }

  return (
    <section
      className="hero-section"
      onTouchStart={(e) => (touchStartX.current = e.changedTouches[0]?.screenX ?? 0)}
      onTouchEnd={(e) => {
        const diff = touchStartX.current - (e.changedTouches[0]?.screenX ?? 0);
        if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
      }}
    >
      {slides.map((slide, i) => {
        const style = {
          "--hero-bg-desktop": `url(${slide.image})`,
          "--hero-bg-mobile": `url(${slide.image})`,
          justifyContent: ALIGN[slide.textPosition ?? "center"] ?? "center",
        } as CSSProperties;
        const textColor = slide.textColor ?? "#ffffff";
        const textAlign = (slide.textPosition ?? "center") as "left" | "center" | "right";
        const TitleTag = i === 0 ? "h1" : "div";

        return (
          <div key={slide.id} className={`hero-slide${i === current ? " active" : ""}`} style={style}>
            <div className="hero-overlay" />
            <div className="hero-content" style={{ position: "relative", zIndex: 2, color: textColor, textAlign }}>
              {slide.title && (
                <TitleTag className="hero-title" style={{ color: textColor }}>
                  {slide.title}
                </TitleTag>
              )}
              {slide.subtitle && (
                <p
                  className="hero-subtitle"
                  style={{
                    color: textColor,
                    marginLeft: textAlign === "center" ? "auto" : undefined,
                    marginRight: textAlign === "center" ? "auto" : undefined,
                  }}
                >
                  {slide.subtitle}
                </p>
              )}
              {slide.linkUrl && (
                <div className="hero-actions">
                  <Link href={slide.linkUrl} className="btn btn-primary btn-lg">
                    {slide.buttonText || "İncele"}
                  </Link>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <>
          <div className="hero-dots">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                className={`hero-dot${i === current ? " active" : ""}`}
                onClick={() => goTo(i)}
                aria-label={`${i + 1}. slayt`}
              />
            ))}
          </div>
          <button type="button" className="hero-arrow hero-arrow-prev" onClick={() => goTo(current - 1)} aria-label="Önceki">
            <i className="fas fa-chevron-left" />
          </button>
          <button type="button" className="hero-arrow hero-arrow-next" onClick={() => goTo(current + 1)} aria-label="Sonraki">
            <i className="fas fa-chevron-right" />
          </button>
        </>
      )}
    </section>
  );
}
