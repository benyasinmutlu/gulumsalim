"use client";

import { useState, type ReactNode } from "react";

type TabKey = "vitrin" | "products" | "collections" | "about";

// vendor-store.php'deki store-tab-nav/store-tab-content JS'inin (switchStoreTab)
// birebir karşılığı - içerik sunucuda hazırlanıp buraya slot olarak
// geçiyor, bu bileşen sadece hangisinin görünür olduğunu yönetiyor
// (display:none/active), old site'daki gibi hepsi DOM'da kalıyor.
export default function VendorStoreTabs({
  productCount,
  vitrin,
  products,
  collections,
  about,
}: {
  productCount: number;
  vitrin: ReactNode;
  products: ReactNode;
  collections: ReactNode;
  about: ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("vitrin");

  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "vitrin", label: "Vitrin", icon: "fa-sparkles" },
    { key: "products", label: `Ürünler (${productCount})`, icon: "fa-tshirt" },
    { key: "collections", label: "Koleksiyonlar", icon: "fa-layer-group" },
    { key: "about", label: "Hakkımızda", icon: "fa-circle-info" },
  ];

  return (
    <>
      <div className="store-tabs">
        <div className="store-tab-nav">
          {TABS.map((t) => (
            <button key={t.key} className={`store-tab-btn${tab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              <i className={`fas ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="store-content">
        <div className={`store-tab-content${tab === "vitrin" ? " active" : ""}`}>{vitrin}</div>
        <div className={`store-tab-content${tab === "products" ? " active" : ""}`}>{products}</div>
        <div className={`store-tab-content${tab === "collections" ? " active" : ""}`}>{collections}</div>
        <div className={`store-tab-content${tab === "about" ? " active" : ""}`}>{about}</div>
      </div>
    </>
  );
}
