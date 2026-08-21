import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { AdminProfile } from "@/lib/types";
import AdminLogoutButton from "./logout-button";
import AdminHeaderBell from "./header-bell";
import AdminSidebarNav from "./sidebar-nav";
import AdminSidebarToggle from "./sidebar-toggle";

async function getAdmin(): Promise<AdminProfile | null> {
  try {
    return await apiFetchJson<AdminProfile>("/admin/auth/me");
  } catch {
    return null;
  }
}

// gulumsalim.com admin panelinin (admin/includes/sidebar.php + header.php)
// birebir karşılığı: sabit sol sidebar, bölümlere ayrılmış navigasyon.
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/giris");

  return (
    <div className="admin-wrapper">
      <aside className="admin-sidebar" id="adminSidebar">
        <div className="sidebar-logo">
          <span className="logo-icon">GS</span>
          <div className="logo-text-wrapper">
            <span className="logo-text">Gülüm Şalım</span>
            <small>Yönetim Paneli</small>
          </div>
        </div>

        <AdminSidebarNav />

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{admin.fullName.charAt(0).toUpperCase()}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{admin.fullName}</div>
              <div className="sidebar-user-role">@{admin.username}</div>
            </div>
            <AdminLogoutButton />
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-header">
          <div className="admin-header-left">
            <AdminSidebarToggle />
            <h1>Yönetim Paneli</h1>
          </div>
          <div className="admin-header-right">
            <AdminHeaderBell />
            <Link href="/" target="_blank" className="view-site-btn">
              <i className="fas fa-external-link-alt" /> Mağazayı Gör
            </Link>
          </div>
        </header>

        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
