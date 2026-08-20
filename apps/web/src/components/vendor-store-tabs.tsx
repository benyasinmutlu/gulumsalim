"use client";

import { useState, type ReactNode } from "react";

type TabKey = "vitrin" | "products" | "collections" | "campaigns" | "reviews" | "about";

// vendor-store.php'deki store-tab-nav/store-tab-content JS'inin (switchStoreTab)
// birebir karşılığı - içerik sunucuda hazırlanıp buraya slot olarak
// geçiyor, bu bileşen sadece hangisinin görünür olduğunu yönetiyor
// (display:none/active), old site'daki gibi hepsi DOM'da kalıyor.
export default function VendorStoreTabs({
  productCount,
  reviewCount,
  vitrin,
  products,
  collections,
  campaigns,
  reviews,
  about,
  showProducts = true,
  showAbout = true,
  showCampaigns = false,
  defaultTab = "vitrin",
}: {
  productCount: number;
  reviewCount: number;
  vitrin: ReactNode;
  products: ReactNode;
  collections: ReactNode;
  campaigns?: ReactNode;
  reviews: ReactNode;
  about: ReactNode;
  showProducts?: boolean;
  showAbout?: boolean;
  defaultTab?: "vitrin" | "products";
  // bkz. kullanıcı isteği (mockup): "Kampanyalar" sekmesi - satıcının
  // onaylanmış/aktif banner'ı VARSA gösterilir, yoksa hiç render edilmez
  // (boş bir sekme sahte olur).
  showCampaigns?: boolean;
}) {
  const [tab, setTab] = useState<TabKey>(defaultTab);

  // bkz. kullanıcı isteği: "satıcı panelinden yapılan ayarların hepsi
  // buraya yansıyacak" - satıcı, mağaza düzeni panelinde "Ürünler" ve
  // "Hakkımızda" bölümlerini gizleyebiliyordu ama bu sekmeler DB'deki
  // storeLayout ayarından bağımsız olarak her zaman gösteriliyordu.
  //
  // bkz. kullanıcı isteği (tasarım brief'i, 2026-08-02): "Sekmeler: Mağaza
  // Ürünleri, Mağaza Hakkında, Değerlendirmeler" - değerlendirmeler daha
  // önce Vitrin sekmesinin içine gömülüydü, ayrı bir sekmeye çıkarıldı
  // (Vitrin/Ürünler/Koleksiyonlar/Kampanyalar zaten daha önceki mockup
  // çalışmasından vardı, bunlar korunuyor - brief'in listesi bunları
  // içermiyor diye kaldırılmadı, sadece Değerlendirmeler eklendi).
  const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: "vitrin", label: "Vitrin", icon: "fa-sparkles" },
    ...(showProducts ? [{ key: "products" as const, label: `Ürünler (${productCount})`, icon: "fa-tshirt" }] : []),
    { key: "collections", label: "Koleksiyonlar", icon: "fa-layer-group" },
    ...(showCampaigns ? [{ key: "campaigns" as const, label: "Kampanyalar", icon: "fa-bullhorn" }] : []),
    { key: "reviews", label: `Değerlendirmeler${reviewCount > 0 ? ` (${reviewCount})` : ""}`, icon: "fa-star" },
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
        {showCampaigns && <div className={`store-tab-content${activeTab === "campaigns" ? " active" : ""}`}>{campaigns}</div>}
        <div className={`store-tab-content${activeTab === "reviews" ? " active" : ""}`}>{reviews}</div>
        {showAbout && <div className={`store-tab-content${activeTab === "about" ? " active" : ""}`}>{about}</div>}
      </div>
    </>
  );
}
