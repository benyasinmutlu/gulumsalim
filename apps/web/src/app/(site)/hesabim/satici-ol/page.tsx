import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import BecomeSellerButton from "./become-seller-button";
import AccountPageHeader from "@/components/account-page-header";

const PERKS = [
  { icon: "fa-bolt", text: "Anında aktif olur, onay beklemezsiniz" },
  { icon: "fa-tags", text: "Kullanmadığınız kıyafetleri, çantaları, ayakkabıları satışa çıkarın" },
  { icon: "fa-shield-halved", text: "Ödeme güvenle platform üzerinden alınır, kargo takibi ile korunursunuz" },
  { icon: "fa-user", text: "Ayrı bir hesap açmanıza gerek yok, mevcut hesabınızla devam edersiniz" },
];

async function getMyVendor(): Promise<VendorProfile | null> {
  try {
    return await apiFetchJson<VendorProfile>("/my/vendor");
  } catch {
    return null;
  }
}

// bkz. olay: 2026-08-01 "vergi nosu ve diğer bilgileri girdiğinde tekrar
// tekrar ürünleri satışa çıkar demesin" - müşteri zaten bireysel satıcı
// olduysa (bkz. become-seller-button.tsx) vergi no/adres formu bir daha
// gösterilmez, doğrudan satıcı paneline yönlendiren bir kart gösterilir.
export default async function SaticiOlPage() {
  const vendor = await getMyVendor();

  return (
    <>
      <AccountPageHeader
        icon="fa-tags"
        title="Ürünlerini Satışa Çıkar"
        subtitle="Kendi mağazanı aç, dakikalar içinde satışa başla"
      />
      <div className="form-card">
        {vendor ? (
          <>
            <p className="account-vendor-note">
              <i className="fas fa-circle-check" /> Zaten bir mağazan var: <strong>{vendor.storeName}</strong>. Vergi
              no ve adres bilgilerini tekrar girmene gerek yok.
            </p>
            <Link href="/satici/panel/urunler/yeni" className="btn btn-primary btn-lg">
              Ürün Ekle
            </Link>{" "}
            <Link href="/satici/panel" className="btn btn-secondary btn-lg">
              Satıcı Panelim
            </Link>
          </>
        ) : (
          <>
            <p className="form-hint form-hint-flush">
              Dolabındaki kullanmadığın ürünleri, ikinci el veya sıfır fark etmeksizin, dakikalar içinde satışa
              çıkarabilirsin.
            </p>
            <ul className="account-perk-list">
              {PERKS.map((p) => (
                <li key={p.text}>
                  <span className="account-perk-icon">
                    <i className={`fas ${p.icon}`} />
                  </span>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
            <BecomeSellerButton />
          </>
        )}
      </div>
    </>
  );
}
