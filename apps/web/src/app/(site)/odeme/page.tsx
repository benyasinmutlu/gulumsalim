import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CartResponse, CustomerAddress, CustomerProfile } from "@/lib/types";
import CheckoutForm from "./checkout-form";

export const metadata: Metadata = { title: "Ödeme | Gülüm Şalım" };

async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

// bkz. kullanıcı isteği: "adresi kayıtlı ise teslimat bilgileri kısmı
// direkt dolu olarak gelsin" - kayıtlı adreslerden varsayılan olanı (yoksa
// ilkini) teslimat formunu önceden doldurmak için kullanılır.
async function getDefaultAddress(): Promise<CustomerAddress | null> {
  try {
    const addresses = await apiFetchJson<CustomerAddress[]>("/addresses");
    if (addresses.length === 0) return null;
    return addresses.find((a) => a.isDefault) ?? addresses[0]!;
  } catch {
    return null;
  }
}

// checkout.php'nin misafir (üyeliksiz) sipariş desteğinin karşılığı - giriş
// zorunlu değil, CheckoutForm oturum yoksa e-posta alanını da ister
// (bkz. checkout-form.tsx, checkout.service.ts resolveCustomerId).
export default async function CheckoutPage() {
  const customer = await getCustomer();
  const defaultAddress = customer ? await getDefaultAddress() : null;

  const cart = await apiFetchJson<CartResponse>("/cart");
  if (cart.items.length === 0) redirect("/sepet");

  const shippingFee = Number(cart.shippingFee);
  const total = Number(cart.subtotal) + shippingFee;

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span>
            <Link href="/sepet">Sepetim</Link> <span className="sep">{">"}</span> <span className="current">Ödeme</span>
          </div>
        </div>
      </div>

      <section className="checkout-section">
        <div className="container">
          <h1 className="page-title">Teslimat Bilgileri</h1>

          <div className="checkout-grid">
            <CheckoutForm isGuest={!customer} defaultAddress={defaultAddress} />

            <div className="cart-summary">
              <h3>Sipariş Özeti</h3>
              {cart.items.map((item) => (
                <div key={`${item.productId}:${item.variantId ?? 0}`} className="summary-row">
                  <span>
                    {item.productName} x{item.quantity}
                  </span>
                  <span>{Number(item.lineTotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>
              ))}
              <div className="summary-row">
                <span>Kargo</span>
                <span>{shippingFee === 0 ? "Ücretsiz" : `${shippingFee.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}</span>
              </div>
              <div className="summary-row total">
                <span>Toplam</span>
                <span>{total.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
