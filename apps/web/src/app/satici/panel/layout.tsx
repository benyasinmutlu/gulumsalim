import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import VendorLogoutButton from "./logout-button";
import VendorSidebarNav from "./sidebar-nav";
import VendorSidebarToggle from "./sidebar-toggle";
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

  return (
    <>
      <aside className="sidebar" id="vendorSidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">
            {vendor.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vendor.logo} alt={vendor.storeName} />
            ) : (
              "🌸"
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
            <small>{vendor.email}</small>
          </div>
          <VendorLogoutButton />
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <VendorSidebarToggle />
          <div className="topbar-title">{vendor.storeName}</div>
          <span className={`st st-${vendor.status === "active" ? "success" : vendor.status === "pending" ? "warn" : "danger"}`}>
            {STATUS_LABEL[vendor.status]}
          </span>
          <a href={`/${vendor.storeSlug}`} target="_blank" className="topbar-icon" title="Mağazamı Gör">
            <i className="fas fa-external-link-alt" />
          </a>
        </div>
        <div className="content">
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
    </>
  );
}
