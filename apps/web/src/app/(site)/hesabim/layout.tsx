import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import type { CustomerProfile } from "@/lib/types";
import AccountNav from "@/components/account-nav";

async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

// bkz. olay: 2026-08-01 "vergi nosu ve diğer bilgileri girdiğinde tekrar
// tekrar ürünleri satışa çıkar demesin" - menüdeki linkin zaten satıcı olan
// müşteride farklı görünmesi için (bkz. account-nav.tsx hasStore).
async function getHasStore(): Promise<boolean> {
  try {
    await apiFetchJson("/my/vendor");
    return true;
  } catch {
    return false;
  }
}

// gulumsalim.com'daki account.php'nin (.account-section/.account-grid)
// karşılığı - sipariş geçmişi, favoriler ve adres defteri artık gerçek
// API uçlarına sahip, bu yüzden hepsi ayrı sekme/sayfa olarak eklendi.
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [customer, hasStore] = await Promise.all([getCustomer(), getHasStore()]);
  if (!customer) redirect("/giris?redirect=/hesabim");

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span>{" "}
            <span className="current">Hesabım</span>
          </div>
        </div>
      </div>

      <section className="account-section">
        <div className="container">
          <h1 className="page-title">Hesabım</h1>

          <div className="account-grid">
            <aside className="account-sidebar">
              <AccountNav hasStore={hasStore} />
            </aside>

            <div>{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
