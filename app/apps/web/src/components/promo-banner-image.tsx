"use client";

import { useEffect, useState } from "react";

// admin/promo-banners.php'deki "Ek Görseller (döngü için)" özelliğinin
// karşılığı - ana görsele ek görseller tanımlıysa rotateSeconds aralıkla
// aralarında geçiş yapar; ek görsel yoksa sade bir <img> gibi davranır.
export default function PromoBannerImage({
  images,
  rotateSeconds,
  alt,
  className,
}: {
  images: string[];
  rotateSeconds?: number | null;
  alt: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const seconds = rotateSeconds && rotateSeconds > 0 ? rotateSeconds : 4;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [images.length, rotateSeconds]);

  const src = images[index] ?? images[0];
  if (!src) return null;

  // eslint-disable-next-line @next/next/no-img-element
  return <img className={className} src={src} alt={alt} style={{ transition: "opacity .4s ease" }} />;
}
