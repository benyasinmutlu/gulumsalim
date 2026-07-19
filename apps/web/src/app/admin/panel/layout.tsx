import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { AdminProfile } from "@/lib/types";
import AdminLogoutButton from "./logout-button";

async function getAdmin(): Promise<AdminProfile | null> {
  try {
    return await apiFetchJson<AdminProfile>("/admin/auth/me");
  } catch {
    return null;
  }
}

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/giris");

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.3rem" }}>Yönetim Paneli</h1>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>{admin.fullName}</span>
          <AdminLogoutButton />
        </div>
      </div>

      <nav className="panel-nav" style={{ marginTop: "1.5rem" }}>
        <Link href="/admin/panel/saticilar">Satıcılar</Link>
        <Link href="/admin/panel/odemeler">Ödemeler</Link>
      </nav>

      {children}
    </main>
  );
}
