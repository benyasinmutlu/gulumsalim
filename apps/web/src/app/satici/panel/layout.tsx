import { redirect } from "next/navigation";
import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import VendorLogoutButton from "./logout-button";

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

export default async function VendorPanelLayout({ children }: { children: React.ReactNode }) {
  const vendor = await getVendor();
  if (!vendor) redirect("/satici/giris");

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1 style={{ fontSize: "1.3rem" }}>{vendor.storeName}</h1>
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
          <span className="badge">{STATUS_LABEL[vendor.status]}</span>
          <VendorLogoutButton />
        </div>
      </div>

      {vendor.status === "pending" && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", opacity: 0.75 }}>
          Mağazanız admin onayı bekliyor. Bu süre boyunca ürün ekleyebilirsiniz ama hiçbiri herkese açık sitede
          görünmeyecek.
        </p>
      )}
      {vendor.status === "suspended" && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.9rem", color: "#d92d20" }}>
          Mağazanız şu anda askıya alınmış durumda, ürünleriniz sitede görünmüyor.
        </p>
      )}

      <nav className="panel-nav" style={{ marginTop: "1.5rem" }}>
        <Link href="/satici/panel">Genel Bakış</Link>
        <Link href="/satici/panel/urunler">Ürünler</Link>
        <Link href="/satici/panel/siparisler">Siparişler</Link>
        <Link href="/satici/panel/finans">Finans</Link>
      </nav>

      {children}
    </main>
  );
}
