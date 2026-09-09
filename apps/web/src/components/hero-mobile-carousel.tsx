"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { ProductListItem } from "../lib/types";
import { productUrl } from "../lib/types";

// bkz. kullanıcı isteği: "sola kaydırma otomatik olsun 2 saniyede bir ...
// o kutunun dışına çıksın ürünler kayarken" - HeroMobileGrid'in eski renkli/
// padding'li kart sarmalayıcısı kaldırıldı (bkz. (site)/page.tsx), bu şerit
// artık sayfanın beyaz zemininde, ekran kenarına kadar taşıyor. Kullanıcı
// dokunup kaydırırken otomatik ilerleme durur, bir süre sonra devam eder.
export default function HeroMobileCarousel({ products }: { products: ProductListItem[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const pausedUntilRef = useRef(0);

  useEffect(() => {
    const row = rowRef.current;
    if (!row || products.length < 2) return;
    const timer = setInterval(() => {
      if (Date.now() < pausedUntilRef.current) return;
      const tile = row.querySelector<HTMLElement>(".hero-mobile-carousel-tile");
      const step = tile ? tile.getBoundingClientRect().width + 12 : row.clientWidth * 0.42;
      const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      row.scrollTo({ left: atEnd ? 0 : row.scrollLeft + step, behavior: "smooth" });
    }, 2400);
    return () => clearInterval(timer);
  }, [products.length]);

  if (products.length === 0) return null;

  const pause = () => {
    pausedUntilRef.current = Date.now() + 4000;
  };

  return (
    <div
      className="hero-mobile-carousel"
      ref={rowRef}
      onPointerDown={pause}
      onTouchStart={pause}
      onWheel={pause}
    >
      {products.map((p, i) => (
        <Link key={p.id} href={productUrl(p)} className="hero-mobile-carousel-tile">
          <div className="hero-mobile-carousel-tile-img-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.primaryImageUrl as string} alt={p.name} className="hero-mobile-carousel-tile-img" loading="lazy" />
            {i === 0 && <span className="hero-mobile-carousel-badge">🏅 Beğenilenler</span>}
          </div>
          <div className="hero-mobile-carousel-tile-body">
            <div className="hero-mobile-carousel-tile-name">{p.name}</div>
            <div className="hero-mobile-carousel-tile-price">
              {Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
