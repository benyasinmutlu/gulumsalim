import Link from "next/link";
import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import type { CartResponse, CustomerProfile } from "@/lib/types";
import CheckoutForm from "./checkout-form";

async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

// checkout.php'nin misafir (üyeliksiz) sipariş desteğinin karşılığı - giriş
// zorunlu değil, CheckoutForm oturum yoksa e-posta alanını da ister
// (bkz. checkout-form.tsx, checkout.service.ts resolveCustomerId).
export default async function CheckoutPage() {
  const customer = await getCustomer();

  const cart = await apiFetchJson<CartResponse>("/cart");
  if (cart.items.length === 0) redirect("/sepet");

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
            <CheckoutForm isGuest={!customer} />

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
              <div className="summary-row total">
                <span>Toplam</span>
                <span>{Number(cart.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ + kargo</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
