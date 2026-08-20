"use client";

import { useRef, useState } from "react";
import FavoriteButton from "./favorite-button";

interface Props {
  productId: number;
  productName: string;
  images: { url: string }[];
}

const SNAP_THRESHOLD_RATIO = 0.18;

// gulumsalim.com'daki ürün detay galerisinin (gallery-track/gallery-thumb)
// birebir karşılığı - küçük resme tıklayınca ana görsel değişir ve aktif
// küçük resim vurgulanır. Ana görsel geçişi, ürün kartındaki (bkz.
// product-card-image.tsx) aynı gerçek zamanlı sürükleme desenini kullanır:
// hem dokunmatik hem fare ile (Pointer Events) parmak/imleç hareket ettikçe
// track anında takip eder, bırakınca en yakın slayta yapışır - masaüstünde
// de mobilde de aynı davranış (bkz. kullanıcı isteği).
export default function ProductGallery({ productId, productName, images }: Props) {
  const [active, setActive] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [dragWidth, setDragWidth] = useState(1);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const trackRef = useRef<HTMLDivElement>(null);

  function clamp(i: number) {
    return Math.max(0, Math.min(images.length - 1, i));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (images.length < 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    setDragWidth(trackRef.current?.parentElement?.getBoundingClientRect().width || 1);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    const atStart = active === 0 && delta > 0;
    const atEnd = active === images.length - 1 && delta < 0;
    setDragPx(atStart || atEnd ? delta * 0.35 : delta);
  }

  function endDrag() {
    if (!dragging) return;
    const ratio = dragPx / dragWidth;
    if (Math.abs(ratio) > SNAP_THRESHOLD_RATIO) {
      setActive((i) => clamp(i + (ratio < 0 ? 1 : -1)));
    }
    setDragPx(0);
    setDragging(false);
  }

  if (images.length === 0) {
    return (
      <div className="product-gallery">
        <div className="gallery-main">
          {productName.charAt(0)}
          <FavoriteButton productId={productId} />
        </div>
      </div>
    );
  }

  const offsetPercent = -(active * 100);
  const dragPercent = (dragPx / dragWidth) * 100;

  return (
    <div className="product-gallery">
      <div
        className="gallery-main"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: images.length > 1 ? "pan-y" : undefined, cursor: images.length > 1 ? (dragging ? "grabbing" : "grab") : undefined }}
      >
        <div
          ref={trackRef}
          className="gallery-track"
          style={{
            transform: `translateX(${offsetPercent + dragPercent}%)`,
            transition: dragging ? "none" : undefined,
          }}
        >
          {images.map((img, i) => (
            <div key={img.url} className="gallery-slide">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`${productName} - ${i + 1}`} draggable={false} />
            </div>
          ))}
        </div>
        <FavoriteButton productId={productId} />
        {images.length > 1 && (
          <div className="gallery-dots">
            {images.map((img, i) => (
              <span key={img.url} className={i === active ? "active" : ""} onClick={() => setActive(i)} />
            ))}
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((img, i) => (
            <div
              key={img.url}
              className={`gallery-thumb${i === active ? " active" : ""}`}
              onClick={() => setActive(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`${productName} - küçük resim ${i + 1}`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
