"use client";

import CircularGallery from "./circular-gallery";
import type { AdminSlider } from "../lib/types";

// Anasayfa hero'sunda eski slider'ın yerine reactbits Circular Gallery
// (WebGL/OGL) - admin slaytlarının görselleri kavisli, sürüklenebilir bir
// galeride döner; başlık her görselin altında etiket olarak görünür.
// intervalMs eski HeroSlider'dan kalan prop - galeri kullanmıyor ama page.tsx
// çağrısını (ve heroIntervalMs değişkenini) bozmadan swap edebilmek için kabul edilir.
export default function HeroGallery({ slides }: { slides: AdminSlider[]; intervalMs?: number }) {
  const items = slides.map((s) => ({ image: s.image, text: s.title ?? "" }));

  return (
    <section className="hero-gallery" aria-label="Öne çıkanlar">
      <CircularGallery
        items={items}
        bend={0.5}
        textColor="#211e1a"
        borderRadius={0.06}
        font="600 30px Georgia, serif"
        scrollSpeed={2}
        scrollEase={0.05}
      />
    </section>
  );
}
