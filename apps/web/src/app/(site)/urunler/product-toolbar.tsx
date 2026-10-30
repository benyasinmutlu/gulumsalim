"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category, PublicVendorListItem } from "@/lib/types";
import { PRODUCT_CONDITIONS } from "@/lib/product-condition";

interface FiltersInitial {
  category?: string;
  search?: string;
  saleOnly?: string;
  secondHand?: string;
  size?: string;
  fitToMe?: string;
  color?: string;
  brand?: string;
  vendor?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  condition?: string;
  freeShipping?: string;
  vendorType?: string;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

// bkz. denetim raporu madde 12: "En çok satan / En çok beğenilen / En
// yüksek indirim" - backend'de zaten hazırdı (bkz. catalog.search.ts
// SORT_MAP), sadece bu listeye hiç eklenmemişti.
const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Önerilen" },
  { value: "newest", label: "En Yeniler" },
  { value: "price-asc", label: "Fiyat: Düşükten Yükseğe" },
  { value: "price-desc", label: "Fiyat: Yüksekten Düşüğe" },
  { value: "best_selling", label: "En Çok Satan" },
  { value: "most_favorited", label: "En Çok Beğenilen" },
  { value: "highest_discount", label: "En Yüksek İndirim" },
];

// gulumsalim.com'daki #productToolbar / #ptPanel yapısının birebir karşılığı:
// üstte yatay kategori çip şeridi + sıralama, sağda "Filtrele" düğmesiyle
// açılan bir panel (masaüstünde dropdown, mobilde alt sayfa - bkz. globals.css
// .pt-panel media query'si, JS gerekmeden salt CSS ile).
export default function ProductToolbar({
  categories,
  vendors,
  brands = [],
  colors = [],
  initial,
  basePath = "/urunler",
  lockedCategorySlug,
}: {
  categories: Category[];
  vendors: PublicVendorListItem[];
  // bkz. denetim raporu madde 11: "Marka" filtresi ve "Renk" filtresinin
  // dropdown'a çevrilmesi - sabit değil, mevcut sonuçlara göre gerçek
  // facet listesi (bkz. product-listing.tsx getFacets).
  brands?: string[];
  colors?: string[];
  initial: FiltersInitial;
  // /aksesuar gibi temiz bir kategori URL'inden render edilirken bu path
  // filtre/sıralama değiştiğinde kalınacak adres olur (category query
  // parametresi eklenmez, zaten yoldan belli) - normal /urunler'de
  // varsayılan olarak kendisi kullanılır.
  basePath?: string;
  // Set edilmişse kategori zaten URL yolundan belli demektir (ör.
  // /aksesuar) - "Tüm Kategoriler" /urunler'e, diğer kategori çipleri
  // kendi temiz yoluna (/bluzlar gibi) gider.
  lockedCategorySlug?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [size, setSize] = useState(initial.size ?? "");
  const [color, setColor] = useState(initial.color ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
  const [vendor, setVendor] = useState(initial.vendor ?? "");
  const [minPrice, setMinPrice] = useState(initial.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice ?? "");
  const [fitToMe, setFitToMe] = useState(initial.fitToMe === "true");
  const [saleOnly, setSaleOnly] = useState(initial.saleOnly === "true");
  const [secondHand, setSecondHand] = useState(initial.secondHand === "true");
  const [freeShipping, setFreeShipping] = useState(initial.freeShipping === "true");
  const [condition, setCondition] = useState(initial.condition ?? "");
  const [vendorType, setVendorType] = useState(initial.vendorType ?? "");
  const [panelOpen, setPanelOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(true);
  // Mobil çekmece document.body'ye portal'lanıyor (bkz. render fonksiyonu
  // altındaki not) - SSR'da document yok, bu yüzden portal sadece
  // mount'tan sonra render edilir.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function applyFilters(overrides: Partial<FiltersInitial> = {}) {
    const next: FiltersInitial = {
      category: lockedCategorySlug ? undefined : initial.category,
      search: initial.search,
      saleOnly: saleOnly ? "true" : undefined,
      secondHand: secondHand ? "true" : undefined,
      size,
      fitToMe: fitToMe ? "true" : undefined,
      color,
      brand,
      vendor,
      minPrice,
      maxPrice,
      // Sıralama artık bu panelin dışında, ürün listesinin sağ üstünde
      // ayrı/bağımsız bir SortControl'de (bkz. sort-control.tsx) - burada
      // elden geçmiyor, sadece URL'deki GÜNCEL değeri korunuyor ki "Sonuçları
      // Göster" diğer filtreleri uygularken sıralamayı sıfırlamasın.
      sort: searchParams.get("sort") ?? undefined,
      condition: condition || undefined,
      freeShipping: freeShipping ? "true" : undefined,
      vendorType: vendorType || undefined,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    router.push(`${basePath}?${params.toString()}`);
    setPanelOpen(false);
  }

  // "Bedenime Uygun": açınca sunucu profildeki bedenleri (+ ±1 komşu, stokta)
  // uygular. Giriş yoksa/beden yoksa sonuç normal gözatma gibi döner (zararsız).
  function toggleFitToMe() {
    const nv = !fitToMe;
    setFitToMe(nv);
    applyFilters({ fitToMe: nv ? "true" : undefined });
  }

  function goToCategory(slug?: string) {
    if (slug) {
      const params = new URLSearchParams();
      if (initial.saleOnly) params.set("saleOnly", initial.saleOnly);
      const qs = params.toString();
      router.push(`/${slug}${qs ? `?${qs}` : ""}`);
      return;
    }
    router.push("/urunler");
  }

  const hasActiveFilters = Boolean(
    size || color || brand || vendor || minPrice || maxPrice || saleOnly || secondHand || freeShipping || condition || vendorType,
  );
  const currentSort = searchParams.get("sort") ?? "";
  const selectedSortLabel = SORT_OPTIONS.find((option) => option.value === currentSort)?.label ?? SORT_OPTIONS[0].label;

  // bkz. keşfedilen hata: bu panel `.products-page`nin (TitleBackgroundIcons
  // katmanlaması için position:relative + z-index:1 taşıyan) içinde render
  // ediliyor - bu, kendi stacking context'ini kurduğu için position:fixed
  // mobil çekmecenin z-index'i (ne kadar yüksek olursa olsun) header/alt
  // navigasyon gibi DIŞARIDAKİ sabit elemanları geçemiyordu. Çözüm: mobil
  // çekmece document.body'ye portal'lanıyor, böylece bu hapsolmuş context'in
  // tamamen dışında, gerçek üst seviyede render ediliyor. Masaüstünde ise
  // panel .products-layout grid'inin bir parçası olarak kalması gerektiği
  // için normal (portal'sız) render ediliyor - CSS (@media max-width:768px)
  // hangisinin görüneceğini seçiyor, ikisi de aynı anda DOM'da olabilir.
  function renderSidebarBody(idSuffix: string) {
    return (
      <>
        <div className="pt-panel-head">
          <h3>
            <i className="fas fa-sliders-h" /> Filtrele
          </h3>
          <button type="button" className="pt-panel-close" aria-label="Kapat" onClick={() => setPanelOpen(false)}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div className="filter-section">
          <a
            className={`pt-chip${fitToMe ? " active" : ""}`}
            onClick={toggleFitToMe}
            title="Profilindeki bedenlere uygun, stoktaki ürünler (bir alt/üst beden dahil)"
          >
            <i className="fas fa-ruler" /> Bedenime Uygun
          </a>
        </div>

        <div className="filter-section">
          <button
            type="button"
            className="filter-title filter-title-toggle"
            aria-expanded={categoryOpen}
            onClick={() => setCategoryOpen((v) => !v)}
          >
            Kategori
            <i className={`fas fa-chevron-${categoryOpen ? "up" : "down"}`} aria-hidden />
          </button>
          {categoryOpen && (
            <ul className="sidebar-category-list">
              <li>
                <a className={!initial.category ? "active" : ""} onClick={() => goToCategory(undefined)}>
                  Tüm Kategoriler
                </a>
              </li>
              {categories.map((c) => (
                <li key={c.id}>
                  <a className={initial.category === c.slug ? "active" : ""} onClick={() => goToCategory(c.slug)}>
                    {c.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="filter-section">
          <label className="pt-panel-label">
            <i className="fas fa-tag" /> Fiyat Aralığı
          </label>
          <div className="pt-price-row">
            <input
              type="number"
              min="0"
              className="form-control"
              placeholder="En az"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <span className="pt-price-sep">—</span>
            <input
              type="number"
              min="0"
              className="form-control"
              placeholder="En çok"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-section">
          <label className="pt-panel-label">
            <i className="fas fa-ruler" /> Beden
          </label>
          <div className="pt-size-list">
            {SIZES.map((s) => (
              <label key={s} className="pt-size-chip">
                <input
                  type="radio"
                  name={`size-${idSuffix}`}
                  checked={size === s}
                  onChange={() => setSize(size === s ? "" : s)}
                />
                <span>{s}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="filter-section">
          <label className="pt-panel-label">
            <i className="fas fa-palette" /> Renk
          </label>
          {colors.length > 0 ? (
            <select className="form-control" value={color} onChange={(e) => setColor(e.target.value)}>
              <option value="">Tüm Renkler</option>
              {colors.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              className="form-control"
              placeholder="ör. Kırmızı"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          )}
        </div>

        {brands.length > 0 && (
          <div className="filter-section">
            <label className="pt-panel-label">
              <i className="fas fa-tags" /> Marka
            </label>
            <select className="form-control" value={brand} onChange={(e) => setBrand(e.target.value)}>
              <option value="">Tüm Markalar</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-section">
          <label className="pt-panel-label">
            <i className="fas fa-certificate" /> Ürün Durumu
          </label>
          <select className="form-control" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="">Tümü</option>
            {PRODUCT_CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-section">
          <label className="pt-panel-label">
            <i className="fas fa-store" /> Satıcı Tipi
          </label>
          <select className="form-control" value={vendorType} onChange={(e) => setVendorType(e.target.value)}>
            <option value="">Tümü</option>
            <option value="individual">Bireysel Satıcı</option>
            <option value="business">Kurumsal Satıcı</option>
          </select>
        </div>

        <div className="filter-section">
          <label className="pt-panel-checkbox">
            <input type="checkbox" checked={saleOnly} onChange={(e) => setSaleOnly(e.target.checked)} />
            <i className="fas fa-tag" /> Yalnızca İndirimli Ürünler
          </label>
          <label className="pt-panel-checkbox">
            <input type="checkbox" checked={secondHand} onChange={(e) => setSecondHand(e.target.checked)} />
            <i className="fas fa-recycle" /> Yalnızca 2. El Ürünler
          </label>
          <label className="pt-panel-checkbox">
            <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} />
            <i className="fas fa-truck" /> Ücretsiz Kargo
          </label>
        </div>

        {vendors.length > 0 && (
          <div className="filter-section">
            <label className="pt-panel-label">
              <i className="fas fa-store" /> Mağaza
            </label>
            <select className="form-control" value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">Tüm Mağazalar</option>
              {vendors.map((v) => (
                <option key={v.storeSlug} value={v.storeSlug}>
                  {v.storeName}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="pt-panel-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={() => applyFilters()}>
            Sonuçları Göster
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="pt-mobile-trigger">
        <button
          type="button"
          className="pt-filter-btn pt-filter-sort-btn"
          aria-expanded={panelOpen}
          aria-controls="productFilterPanelMobile"
          onClick={() => setPanelOpen((v) => !v)}
        >
          <i className="fas fa-sliders-h" />
          <span className="pt-filter-sort-copy">
            <strong>Filtrele ve Sırala</strong>
            <small>{selectedSortLabel}</small>
          </span>
          <i className={`fas fa-chevron-${panelOpen ? "up" : "down"} pt-filter-chevron`} aria-hidden />
          {hasActiveFilters && <span className="pt-filter-dot" />}
        </button>
      </div>

      {/* Masaüstü: .products-layout grid'inin sol sütunu, her zaman akışta. */}
      <aside className="filter-sidebar filter-sidebar-desktop">{renderSidebarBody("desktop")}</aside>

      {/* Mobil: document.body'ye portal'lanan kayar çekmece. */}
      {mounted &&
        createPortal(
          <>
            <div className={`filter-overlay${panelOpen ? " active" : ""}`} onClick={() => setPanelOpen(false)} />
            <aside
              className={`filter-sidebar filter-sidebar-mobile${panelOpen ? " pt-mobile-open" : ""}`}
              id="productFilterPanelMobile"
            >
              {renderSidebarBody("mobile")}
            </aside>
          </>,
          document.body,
        )}
    </>
  );
}
