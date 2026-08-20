"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { VendorStoreSlide } from "@/lib/types";

// vendor/store-layout.php'deki satıcıya özel slider'ın karşılığı -
// site geneli HeroSlider'la aynı fikir, vstore-slider CSS'ine göre
// (bkz. globals.css) daha kompakt bir track/dot yapısı kullanır.
export default function VendorStoreSlider({ slides }: { slides: VendorStoreSlide[] }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % slides.length), 6000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className="vstore-slider">
      <div className="vstore-slider-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {slides.map((s) => (
          <div key={s.id} className="vstore-slide">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.image} alt={s.title ?? ""} />
            {(s.title || s.subtitle || s.linkUrl) && (
              <div className="vstore-slide-caption">
                {s.title && <h3>{s.title}</h3>}
                {s.subtitle && <p>{s.subtitle}</p>}
                {s.linkUrl && (
                  <Link href={s.linkUrl} className="vstore-slide-btn">
                    {s.buttonText || "İncele"}
                  </Link>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="vstore-slider-dots">
          {slides.map((s, i) => (
            <span key={s.id} className={i === current ? "active" : ""} onClick={() => setCurrent(i)} />
          ))}
        </div>
      )}
    </div>
  );
}
