"use client";

import { useState } from "react";
import FavoriteButton from "./favorite-button";

interface Props {
  productId: number;
  productName: string;
  images: { url: string }[];
}

// gulumsalim.com'daki ürün detay galerisinin (gallery-track/gallery-thumb)
// birebir karşılığı - önceki sürüm küçük resimleri gösteriyordu ama
// tıklandığında ana görsel hiç değişmiyordu (dead UI). Burada gerçek bir
// aktif slayt state'i var: küçük resme tıklayınca ana görsel değişir ve
// aktif küçük resim vurgulanır.
export default function ProductGallery({ productId, productName, images }: Props) {
  const [active, setActive] = useState(0);

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

  return (
    <div className="product-gallery">
      <div className="gallery-main">
        <div className="gallery-track" style={{ transform: `translateX(-${active * 100}%)` }}>
          {images.map((img, i) => (
            <div key={img.url} className="gallery-slide">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={`${productName} - ${i + 1}`} />
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
