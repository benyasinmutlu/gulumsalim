import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Props {
  searchParams: Promise<{ order?: string; success?: string; access?: string }>;
}

interface OrderSummary {
  orderNumber: string;
  total: string;
  status: string;
}

type OrderLookup =
  | { state: "found"; order: OrderSummary }
  | { state: "missing" }
  | { state: "unavailable" };

async function getOrder(orderNumber: string, access?: string): Promise<OrderLookup> {
  const query = access ? `?access=${encodeURIComponent(access)}` : "";
  try {
    const res = await apiFetch(`/orders/${encodeURIComponent(orderNumber)}${query}`);
    if (res.status === 404 || res.status === 401 || res.status === 403) return { state: "missing" };
    if (!res.ok) return { state: "unavailable" };
    return { state: "found", order: await res.json() };
  } catch {
    return { state: "unavailable" };
  }
}

// order-success.php gerçek bir sipariş olmadan her zaman anasayfaya
// yönlendirdiği için eski sitenin birebir HTML'i çıkarılamadı - site
// genelindeki .cart-section / .empty-state diliyle tutarlı bir sonuç
// ekranı kuruldu.
export default async function OrderResultPage({ searchParams }: Props) {
  const { order: orderNumber, success, access } = await searchParams;
  const lookup = orderNumber ? await getOrder(orderNumber, access) : { state: "missing" as const };
  const isPending = success === "true" && lookup.state !== "found";
  const retryHref = `/siparis-sonucu?order=${encodeURIComponent(orderNumber ?? "")}&success=true${access ? `&access=${encodeURIComponent(access)}` : ""}`;

  return (
    <main className="main-content">
      <section className="cart-section">
        <div className="container">
          <div className="empty-state">
            {success === "true" && lookup.state === "found" ? (
              <>
                <i className="fas fa-check-circle" style={{ color: "var(--color-success)" }} />
                <h2>Siparişiniz Alındı</h2>
                <p>
                  Sipariş No: <strong>{lookup.order.orderNumber}</strong>
                </p>
                <p className="price-current" style={{ display: "block", marginBottom: "1.5rem" }}>
                  Toplam: {Number(lookup.order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </p>
              </>
            ) : isPending ? (
              <>
                <i className="fas fa-clock" style={{ color: "var(--color-warning)" }} />
                <h2>Siparişiniz Doğrulanıyor</h2>
                <p>Ödeme sonucu alındı; sipariş bilgileri kısa süre içinde görünecek. Bu sırada tekrar ödeme yapmayın.</p>
                <Link href={retryHref} className="btn btn-secondary btn-lg" style={{ marginBottom: 12 }}>
                  Durumu Yenile
                </Link>
              </>
            ) : (
              <>
                <i className="fas fa-times-circle" style={{ color: "var(--color-error)" }} />
                <h2>Ödeme Tamamlanamadı</h2>
                <p>Sepetiniz korunuyor olabilir, lütfen tekrar deneyin veya bizimle iletişime geçin.</p>
              </>
            )}
            <Link href="/urunler" className="btn btn-primary btn-lg">
              Alışverişe Devam Et
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
