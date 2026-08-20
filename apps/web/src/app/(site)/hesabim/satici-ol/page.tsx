import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import type { VendorProfile } from "@/lib/types";
import BecomeSellerButton from "./become-seller-button";

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
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-tags" />
        </div>
        <div>
          <h3>Ürünlerini Satışa Çıkar</h3>
          <div className="account-page-subtitle">Kendi mağazanı aç, dakikalar içinde satışa başla</div>
        </div>
      </div>
      <div className="form-card">
        {vendor ? (
          <>
            <p style={{ fontSize: "0.9rem", marginBottom: 20 }}>
              <i className="fas fa-circle-check" style={{ color: "var(--color-success)", marginRight: 6 }} />
              Zaten bir mağazan var: <strong>{vendor.storeName}</strong>. Vergi no ve adres bilgilerini tekrar
              girmene gerek yok.
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
            <p style={{ fontSize: "0.9rem", color: "var(--color-text-light)", marginBottom: 20 }}>
              Dolabındaki kullanmadığın ürünleri, ikinci el veya sıfır fark etmeksizin, dakikalar içinde satışa
              çıkarabilirsin.
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {PERKS.map((p) => (
                <li key={p.text} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.9rem" }}>
                  <span
                    style={{
                      width: 34, height: 34, borderRadius: "50%", background: "var(--color-primary)", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13,
                    }}
                  >
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
