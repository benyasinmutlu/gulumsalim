import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import VendorLogoutButton from "./logout-button";
import VendorMobileNav from "./vendor-mobile-nav";
import VendorSidebarNav from "./sidebar-nav";
import VendorSidebarToggle from "./sidebar-toggle";
import { VendorTypeProvider } from "./vendor-type-context";
import "./satici.css";

async function getVendor(): Promise<VendorProfile | null> {
  try {
    return await apiFetchJson<VendorProfile>("/vendor/auth/me");
  } catch {
    return null;
  }
}

const STATUS_LABEL: Record<VendorProfile["status"], string> = {
  pending: "Onay Bekliyor",
  active: "Aktif",
  suspended: "Askıda",
  banned: "Yasaklı",
};

// gulumsalim.com'daki vendor/boot.php içindeki vendorSidebar()'ın birebir
// karşılığı: sabit sol sidebar + üst topbar.
export default async function VendorPanelLayout({ children }: { children: React.ReactNode }) {
  const vendor = await getVendor();
  if (!vendor) redirect("/satici/giris");
  // bkz. kullanıcı isteği: "bireysel satıcının paneli ... çok daha
  // kullanışlı olmalı ... dolap gibi" - mobilde sidebar/hamburger yerine
  // alt tab-bar (bkz. vendor-mobile-nav.tsx), sadece bireysel satıcılarda.
  const isIndividual = vendor.vendorType === "individual";

  return (
    <VendorTypeProvider vendorType={vendor.vendorType}>
      <aside className="sidebar" id="vendorSidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            {vendor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo} alt={vendor.storeName} />
            ) : (
              "GS"
            )}
          </div>
          <div className="logo-text">
            <span>{vendor.storeName}</span>
            <small>Satıcı Paneli</small>
          </div>
        </div>
        <VendorSidebarNav />
        <div className="sidebar-footer">
          <div className="avatar">
            {vendor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo} alt={vendor.storeName} />
            ) : (
              vendor.storeName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="vendor-info">
            <strong>{vendor.storeName}</strong>
            {/* bkz. vendor-auth.service.ts becomeIndividualSeller - bireysel
                satıcının e-postası artık namespaced (ör. "+ind42"), müşteriye
                garip görünmemesi için burada hiç gösterilmiyor. */}
            <small>{isIndividual ? "Bireysel Satıcı" : vendor.email}</small>
          </div>
          <VendorLogoutButton />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          {/* bkz. olay: 2026-08-01 "dışarı tıkladığımda kapanmıyor" -
              bireysel satıcıda mobilde artık sidebar/hamburger yerine alt
              tab-bar + "Daha Fazla" sayfası var (bkz. vendor-mobile-nav.tsx),
              bu yüzden çakışan iki açma/kapama mekanizması olmasın diye
              hamburger bireysel satıcıda hiç render edilmiyor. */}
          {!isIndividual && <VendorSidebarToggle />}
          <div className="topbar-title">{vendor.storeName}</div>
          <span className={`st st-${vendor.status === "active" ? "success" : vendor.status === "pending" ? "warn" : "danger"}`}>
            {STATUS_LABEL[vendor.status]}
          </span>
          <a href={`/${vendor.storeSlug}`} target="_blank" className="topbar-icon" title="Mağazamı Gör">
            <i className="fas fa-external-link-alt" />
          </a>
        </div>
        <div className={`content${isIndividual ? " content-mobile-pad" : ""}`}>
          {vendor.status === "pending" && (
            <div className="alert alert-wa">
              <i className="fas fa-triangle-exclamation" /> Mağazanız admin onayı bekliyor. Bu süre boyunca ürün
              ekleyebilirsiniz ama hiçbiri herkese açık sitede görünmeyecek.
            </div>
          )}
          {vendor.status === "suspended" && (
            <div className="alert alert-er">
              <i className="fas fa-triangle-exclamation" /> Mağazanız şu anda askıya alınmış durumda, ürünleriniz
              sitede görünmüyor.
            </div>
          )}
          {children}
        </div>
      </main>
      {isIndividual && <VendorMobileNav />}
    </VendorTypeProvider>
  );
}
