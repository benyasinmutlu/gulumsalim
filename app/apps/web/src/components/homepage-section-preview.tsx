"use client";

import Link from "next/link";
import type { ProductListItem, ResolvedHomepageSectionBanner } from "@/lib/types";
import ProductCard from "@/components/product-card";
import PromoBannerImage from "@/components/promo-banner-image";

const TITLE_FONT_CLASS: Record<string, string> = {
  sans: "sec-font-sans",
  italic: "sec-font-italic",
};

interface SectionStyle {
  title: string;
  subtitle?: string;
  titleColor?: string;
  titleFont?: string;
  subtitleColor?: string;
  bgStyle?: string;
  bgColor?: string;
  bannerLayout?: string;
  showTitle?: boolean;
}

// (site)/page.tsx'deki ProductRow/BannerRow'un admin önizleme paneli için
// küçültülmüş (hscroll/ScrollReveal olmadan, statik grid) karşılığı -
// homepage-preview-render.php'nin yaptığı gibi gerçek bileşenlerle,
// henüz kaydedilmemiş form değerlerini anında yansıtır.
export function HomepageProductPreview({ style, products }: { style: SectionStyle; products: ProductListItem[] }) {
  if (products.length === 0) {
    return (
      <div className="admin-empty" style={{ padding: 24 }}>
        <i className="fas fa-image" />
        <h3>Bu ayarlarla hiç ürün bulunamadı</h3>
      </div>
    );
  }
  return (
    <section className={`products-section${style.bgStyle === "alt" ? " section-bg-alt" : ""}`} style={{ background: style.bgColor ?? undefined, padding: "24px 0" }}>
      <div className="section-scroll-shell">
        <div className="section-header section-header-flex">
          <div>
            <h2 className={`section-title ${TITLE_FONT_CLASS[style.titleFont ?? ""] ?? ""}`} style={{ color: style.titleColor ?? undefined }}>
              {style.title || "Başlık"}
            </h2>
            {style.subtitle && (
              <p className="section-subtitle" style={{ color: style.subtitleColor ?? undefined }}>
                {style.subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="product-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomepageBannerPreview({ style, banners }: { style: SectionStyle; banners: ResolvedHomepageSectionBanner[] }) {
  if (banners.length === 0) {
    return (
      <div className="admin-empty" style={{ padding: 24 }}>
        <i className="fas fa-bullhorn" />
        <h3>Gösterilecek banner yok</h3>
      </div>
    );
  }
  const isStack = style.bannerLayout === "stack";
  return (
    <section className={`products-section promo-section-plain${style.bgStyle === "alt" ? " section-bg-alt" : ""}`} style={{ background: style.bgColor ?? undefined, padding: "24px 0" }}>
      {style.showTitle && (
        <div className="section-header promo-section-title">
          <h2 className={`section-title ${TITLE_FONT_CLASS[style.titleFont ?? ""] ?? ""}`} style={{ color: style.titleColor ?? undefined }}>
            {style.title || "Başlık"}
          </h2>
          {style.subtitle && (
            <p className="section-subtitle" style={{ color: style.subtitleColor ?? undefined }}>
              {style.subtitle}
            </p>
          )}
        </div>
      )}
      <div className={isStack ? "promo-stack" : "promo-grid"}>
        {banners.map((b) => (
          <Link key={b.id} href={b.resolvedLink ?? "/urunler"} className="promo-card">
            <PromoBannerImage
              className="promo-card-img"
              images={[b.image, ...(b.extraImages ?? [])]}
              rotateSeconds={b.rotateSeconds}
              alt={b.title}
            />
            <div className="promo-card-overlay" />
            <div className="promo-content" style={{ color: b.textColor ?? undefined }}>
              <h3 style={{ color: b.textColor ?? undefined }}>{b.title}</h3>
              {b.subtitle && <p>{b.subtitle}</p>}
              {b.buttonText && <span className="btn btn-sm btn-primary promo-cta">{b.buttonText}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
