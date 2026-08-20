"use client";

import Link from "next/link";
import { useRef, useState } from "react";

interface Props {
  href: string;
  images: string[];
  alt: string;
}

const SNAP_THRESHOLD_RATIO = 0.18;
const DRAG_IGNORE_CLICK_PX = 6;

// Ürün kartında detaya girmeden görsel değiştirme (bkz. kullanıcı isteği:
// "ok ile geçmeyecekler parmakla kaydırıp geçecekler tıpkı slider gibi
// kaydırırken yeni ve eski resim takip edecek ... desktopda da popüler
// çözümlerden yap") - ok/nokta yerine gerçek zamanlı sürükleme: parmak/fare
// hareket ettikçe track anında takip eder, bırakınca en yakın slayta
// yapışır. Pointer Events dokunmatik ve fare için tek bir kod yolu sağlar.
export default function ProductCardImage({ href, images, alt }: Props) {
  const [active, setActive] = useState(0);
  const [dragPx, setDragPx] = useState(0);
  const [dragWidth, setDragWidth] = useState(1);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const movedPastClickThreshold = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  function clamp(i: number) {
    return Math.max(0, Math.min(images.length - 1, i));
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (images.length < 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    startX.current = e.clientX;
    movedPastClickThreshold.current = false;
    setDragWidth(trackRef.current?.parentElement?.getBoundingClientRect().width || 1);
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > DRAG_IGNORE_CLICK_PX) movedPastClickThreshold.current = true;
    // Uçlarda hafif direnç (rubber-band) - ilk/son görselde daha fazla çekmek
    // ekranı orantısız kaydırmasın.
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

  function handleClick(e: React.MouseEvent) {
    if (movedPastClickThreshold.current) {
      e.preventDefault();
    }
  }

  const offsetPercent = -(active * 100);
  const dragPercent = (dragPx / dragWidth) * 100;

  return (
    <div className="product-image-carousel">
      <Link
        href={href}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{ touchAction: images.length > 1 ? "pan-y" : undefined }}
      >
        <div
          ref={trackRef}
          className="product-image-track"
          style={{
            transform: `translateX(${offsetPercent + dragPercent}%)`,
            transition: dragging ? "none" : undefined,
          }}
        >
          {images.map((url, i) => (
            <div className="product-image-slide" key={url + i}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${alt} - ${i + 1}`} draggable={false} />
            </div>
          ))}
        </div>
      </Link>
      {images.length > 1 && (
        <div className="product-image-dots">
          {images.map((url, i) => (
            <span key={url + i} className={i === active ? "active" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}
