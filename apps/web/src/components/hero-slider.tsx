"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { AdminSlider } from "../lib/types";

const ALIGN: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

// bkz. kullanıcı isteği: "kadının gücünü kaldıralım ... animasyonla efektle
// background renkleri yazılarıyla çok daha öne çıkartalım" - site geneli
// monokrom ama ürün spotlight'ı bilinçli olarak bundan ayrılıp kendi yumuşak
// pastel paletiyle (çocuk kategori temalarında kullandığımız aynı ton
// ailesi - toz mavi/pembe - bkz. theme-boy/theme-girl) döner, her slaytta
// --color-primary'i override ederek .hero-tag/.btn-primary otomatik
// temalanır.
const PRODUCT_PALETTES: { bg: string; accent: string; dark: string; rgb: string }[] = [
  { bg: "linear-gradient(135deg, #FBEEF2 0%, #F5DCE3 100%)", accent: "#C98CA0", dark: "#A66A7E", rgb: "201, 140, 160" },
  { bg: "linear-gradient(135deg, #EAF0F5 0%, #DCE6EE 100%)", accent: "#7FA0BF", dark: "#5D7C9B", rgb: "127, 160, 191" },
  { bg: "linear-gradient(135deg, #F8F3E7 0%, #EFE4C9 100%)", accent: "#B8934A", dark: "#8A6F35", rgb: "184, 147, 74" },
  { bg: "linear-gradient(135deg, #F1F4EE 0%, #E1E8DA 100%)", accent: "#8FA382", dark: "#657356", rgb: "143, 163, 130" },
];

const PRODUCT_TAGS = ["🔥 Çok Satan", "✨ Sezonun Trendi", "💫 Öne Çıkan", "🌟 Beğenilenler"];

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
          const palette = PRODUCT_PALETTES[i % PRODUCT_PALETTES.length];
          const tag = PRODUCT_TAGS[i % PRODUCT_TAGS.length];
          const themeStyle = {
            "--hero-product-bg": palette.bg,
            "--color-primary": palette.accent,
            "--color-primary-dark": palette.dark,
            "--color-primary-rgb": palette.rgb,
          } as CSSProperties;
          return (
            <div key={slide.id} className={`hero-slide hero-slide-product${isActive ? " active" : ""}`} style={themeStyle}>
              <span className="hero-product-blob hero-product-blob-1" />
              <span className="hero-product-blob hero-product-blob-2" />
              <div className="hero-product-slide">
                <div className="hero-product-text">
                  <span className="hero-tag">{tag}</span>
                  {slide.title && <TitleTag className="hero-title">{slide.title}</TitleTag>}
                  {slide.subtitle && <p className="hero-product-price">{slide.subtitle}</p>}
                  {slide.linkUrl && (
                    <div className="hero-actions">
                      <Link href={slide.linkUrl} className="btn btn-primary btn-lg">
                        {slide.buttonText || "İncele"} <i className="fas fa-arrow-right" style={{ fontSize: 13 }} />
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
