"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, PublicVendorListItem } from "@/lib/types";

interface FiltersInitial {
  category?: string;
  search?: string;
  saleOnly?: string;
  size?: string;
  color?: string;
  vendor?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
}

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Önerilen" },
  { value: "newest", label: "En Yeniler" },
  { value: "price-asc", label: "Fiyat: Düşükten Yükseğe" },
  { value: "price-desc", label: "Fiyat: Yüksekten Düşüğe" },
];

// gulumsalim.com'daki #productToolbar / #ptPanel yapısının birebir karşılığı:
// üstte yatay kategori çip şeridi + sıralama, sağda "Filtrele" düğmesiyle
// açılan bir panel (masaüstünde dropdown, mobilde alt sayfa - bkz. globals.css
// .pt-panel media query'si, JS gerekmeden salt CSS ile).
export default function ProductToolbar({
  categories,
  vendors,
  initial,
  basePath = "/urunler",
  lockedCategorySlug,
}: {
  categories: Category[];
  vendors: PublicVendorListItem[];
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
  const [size, setSize] = useState(initial.size ?? "");
  const [color, setColor] = useState(initial.color ?? "");
  const [vendor, setVendor] = useState(initial.vendor ?? "");
  const [minPrice, setMinPrice] = useState(initial.minPrice ?? "");
  const [maxPrice, setMaxPrice] = useState(initial.maxPrice ?? "");
  const [sort, setSort] = useState(initial.sort ?? "");
  const [panelOpen, setPanelOpen] = useState(false);

  function applyFilters(overrides: Partial<FiltersInitial> = {}) {
    const next: FiltersInitial = {
      category: lockedCategorySlug ? undefined : initial.category,
      search: initial.search,
      saleOnly: initial.saleOnly,
      size,
      color,
      vendor,
      minPrice,
      maxPrice,
      sort,
      ...overrides,
    };
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    router.push(`${basePath}?${params.toString()}`);
    setPanelOpen(false);
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

  const hasActiveFilters = Boolean(size || color || vendor || minPrice || maxPrice || sort);

  return (
    <div className="product-toolbar" id="productToolbar">
      <div className="pt-row">
        <div className="pt-chips" id="ptChips">
          <a className={`pt-chip${!initial.category ? " active" : ""}`} onClick={() => goToCategory(undefined)}>
            Tüm Kategoriler
          </a>
          {categories.map((c) => (
            <a
              key={c.id}
              className={`pt-chip${initial.category === c.slug ? " active" : ""}`}
              onClick={() => goToCategory(c.slug)}
            >
              {c.name}
            </a>
          ))}
        </div>

        <div className="pt-actions">
          <button type="button" className="pt-filter-btn" onClick={() => setPanelOpen((v) => !v)}>
            <i className="fas fa-sliders-h" /> Filtrele
            {hasActiveFilters && <span className="pt-filter-dot" />}
          </button>
          <select
            className="sort-select"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              applyFilters({ sort: e.target.value });
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className={`pt-panel${panelOpen ? " open" : ""}`}>
            <div className="pt-panel-head">
              <h3>
                <i className="fas fa-sliders-h" /> Filtrele
              </h3>
              <button type="button" className="pt-panel-close" aria-label="Kapat" onClick={() => setPanelOpen(false)}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div className="pt-panel-body">
              <div className="pt-panel-section">
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

              <div className="pt-panel-section">
                <label className="pt-panel-label">
                  <i className="fas fa-ruler" /> Beden
                </label>
                <div className="pt-size-list">
                  {SIZES.map((s) => (
                    <label key={s} className="pt-size-chip">
                      <input type="radio" name="size" checked={size === s} onChange={() => setSize(size === s ? "" : s)} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-panel-section">
                <label className="pt-panel-label">
                  <i className="fas fa-palette" /> Renk
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="ör. Kırmızı"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>

              {vendors.length > 0 && (
                <div className="pt-panel-section">
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
            </div>
            <div className="pt-panel-actions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => applyFilters()}>
                Filtreleri Uygula
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
