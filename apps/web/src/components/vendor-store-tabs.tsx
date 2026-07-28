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
  showProducts = true,
  showAbout = true,
}: {
  productCount: number;
  vitrin: ReactNode;
  products: ReactNode;
  collections: ReactNode;
  about: ReactNode;
  showProducts?: boolean;
  showAbout?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>("vitrin");

  // bkz. kullanıcı isteği: "satıcı panelinden yapılan ayarların hepsi
  // buraya yansıyacak" - satıcı, mağaza düzeni panelinde "Ürünler" ve
  // "Hakkımızda" bölümlerini gizleyebiliyordu ama bu sekmeler DB'deki
  // storeLayout ayarından bağımsız olarak her zaman gösteriliyordu.
  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "vitrin", label: "Vitrin", icon: "fa-sparkles" },
    ...(showProducts ? [{ key: "products" as const, label: `Ürünler (${productCount})`, icon: "fa-tshirt" }] : []),
    { key: "collections", label: "Koleksiyonlar", icon: "fa-layer-group" },
    ...(showAbout ? [{ key: "about" as const, label: "Hakkımızda", icon: "fa-circle-info" }] : []),
  ];

  const activeTab = TABS.some((t) => t.key === tab) ? tab : "vitrin";

  return (
    <>
      <div className="store-tabs">
        <div className="store-tab-nav">
          {TABS.map((t) => (
            <button key={t.key} className={`store-tab-btn${activeTab === t.key ? " active" : ""}`} onClick={() => setTab(t.key)}>
              <i className={`fas ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="store-content">
        <div className={`store-tab-content${activeTab === "vitrin" ? " active" : ""}`}>{vitrin}</div>
        {showProducts && <div className={`store-tab-content${activeTab === "products" ? " active" : ""}`}>{products}</div>}
        <div className={`store-tab-content${activeTab === "collections" ? " active" : ""}`}>{collections}</div>
        {showAbout && <div className={`store-tab-content${activeTab === "about" ? " active" : ""}`}>{about}</div>}
      </div>
    </>
  );
}
