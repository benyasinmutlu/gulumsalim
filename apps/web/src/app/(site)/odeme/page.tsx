import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CartResponse, CustomerAddress, CustomerProfile } from "@/lib/types";
import CheckoutForm from "./checkout-form";

export const metadata: Metadata = { title: "Ödeme | Gülüm Şalım" };

interface Props {
  searchParams: Promise<{ selected?: string }>;
}

// "productId:variantId" anahtarlarını POST /checkout body'sindeki
// selectedLines şekline çevirir (bkz. checkout.schemas.ts selectedLineSchema).
function parseSelectedLines(selected?: string) {
  if (!selected) return undefined;
  return selected
    .split(",")
    .map((key) => {
      const [productIdRaw, variantIdRaw] = key.split(":");
      const productId = Number(productIdRaw);
      const variantId = Number(variantIdRaw);
      if (!Number.isInteger(productId) || productId <= 0) return null;
      return variantId > 0 ? { productId, variantId } : { productId };
    })
    .filter((l): l is { productId: number; variantId?: number } => l !== null);
}

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
export default async function CheckoutPage({ searchParams }: Props) {
  const { selected } = await searchParams;
  const customer = await getCustomer();
  const defaultAddress = customer ? await getDefaultAddress() : null;

  const cart = await apiFetchJson<CartResponse>(selected ? `/cart?selected=${encodeURIComponent(selected)}` : "/cart");
  if (cart.items.length === 0) redirect("/sepet");

  const selectedLines = parseSelectedLines(selected);

  const shippingFee = Number(cart.shippingFee);
  const discountAmount = Number(cart.discountAmount);
  const total = Number(cart.total);

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

          {/* bkz. kullanıcı isteği: "stok durumu sürekli kontrol ettirilmeli
              hem sepette hemde ödeme yapılırken" - GET /cart burada da
              hydrateCart üzerinden geçtiği için miktarlar zaten gerçek
              stoğa göre düzeltilmiş gelir, sadece bu düzeltme açıkça
              gösterilir. */}
          {cart.stockNotices.length > 0 && (
            <div className="cart-stock-notice" style={{ marginBottom: 20 }}>
              {cart.stockNotices.map((n, i) => (
                <p key={i}>
                  <i className="fas fa-exclamation-triangle" /> <strong>{n.productName}{n.variantLabel ? ` (${n.variantLabel})` : ""}</strong>{" "}
                  için stok yetersiz, miktar {n.availableStock} adete güncellendi.
                </p>
              ))}
            </div>
          )}

          <div className="checkout-grid">
            <CheckoutForm isGuest={!customer} defaultAddress={defaultAddress} selectedLines={selectedLines} />

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
              {cart.discountSource === "coupon" && cart.appliedCouponCode && discountAmount > 0 && (
                <div className="summary-row coupon-discount-row">
                  <span>
                    <i className="fas fa-tag" /> Kupon ({cart.appliedCouponCode})
                  </span>
                  <span>-{discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>
              )}
              {cart.discountSource === "campaign" && discountAmount > 0 && (
                <div className="summary-row coupon-discount-row">
                  <span>
                    <i className="fas fa-bullhorn" /> Kampanya indirimi
                  </span>
                  <span>-{discountAmount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                </div>
              )}
              <div className="summary-row">
                <span>Kargo{cart.shippingBreakdown.length > 1 ? ` (${cart.shippingBreakdown.length} satıcı)` : ""}</span>
                <span>{shippingFee === 0 ? "Ücretsiz" : `${shippingFee.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}</span>
              </div>
              {cart.shippingBreakdown.length > 1 &&
                cart.shippingBreakdown.map((b, i) => (
                  <div
                    key={i}
                    className="summary-row"
                    style={{ fontSize: "0.8rem", color: "var(--color-text-light)", paddingLeft: 14, marginTop: -4 }}
                  >
                    <span>
                      <i className="fas fa-store" style={{ fontSize: 10, opacity: 0.6 }} /> {b.storeName}
                    </span>
                    <span>{b.free ? "Ücretsiz" : `${Number(b.fee).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺`}</span>
                  </div>
                ))}
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
