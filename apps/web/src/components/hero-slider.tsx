"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { AdminSlider } from "../lib/types";

const ALIGN: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

// bkz. kullanıcı isteği: "'Kadının Gücü' yerinde ürünler dönsün" sonrası
// "hiç olmadı bu şekilde" - ürün fotoğrafları dikey stüdyo çekimi, admin
// banner'ları gibi tam ekran background-size:cover yapınca kafa/etek kesilip
// feci kırpılıyordu. "product" slaytları artık banner'lardan tamamen farklı
// bir düzen kullanır: fotoğraf tam ekran arka plan değil, sağda kırpılmadan
// (object-fit: contain) gösterilen bir görsel, solda metin - bkz.
// .hero-slide-product / .hero-product-slide (globals.css).
export interface HeroSlide extends AdminSlider {
  kind?: "banner" | "product";
}

export default function HeroSlider({ slides, intervalMs = 6000 }: { slides: HeroSlide[]; intervalMs?: number }) {
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
        const TitleTag = i === 0 ? "h1" : "div";
        const isActive = i === current;

        if (slide.kind === "product") {
          return (
            <div key={slide.id} className={`hero-slide hero-slide-product${isActive ? " active" : ""}`}>
              <div className="hero-product-slide">
                <div className="hero-product-text">
                  {slide.title && <TitleTag className="hero-title">{slide.title}</TitleTag>}
                  {slide.subtitle && <p className="hero-subtitle">{slide.subtitle}</p>}
                  {slide.linkUrl && (
                    <div className="hero-actions">
                      <Link href={slide.linkUrl} className="btn btn-primary btn-lg">
                        {slide.buttonText || "İncele"}
                      </Link>
                    </div>
                  )}
                </div>
                <div className="hero-product-media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={slide.image} alt={slide.title ?? ""} loading={i === 0 ? undefined : "lazy"} />
                </div>
              </div>
            </div>
          );
        }

        const style = {
          "--hero-bg-desktop": `url(${slide.image})`,
          "--hero-bg-mobile": `url(${slide.image})`,
          justifyContent: ALIGN[slide.textPosition ?? "center"] ?? "center",
        } as CSSProperties;
        const textColor = slide.textColor ?? "#ffffff";
        const textAlign = (slide.textPosition ?? "center") as "left" | "center" | "right";

        return (
          <div key={slide.id} className={`hero-slide${isActive ? " active" : ""}`} style={style}>
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
                <div
                  className="hero-actions"
                  style={{
                    justifyContent:
                      textAlign === "center" ? "center" : textAlign === "right" ? "flex-end" : "flex-start",
                  }}
                >
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
