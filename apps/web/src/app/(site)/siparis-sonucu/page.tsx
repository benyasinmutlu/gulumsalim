import Link from "next/link";
import { apiFetch } from "@/lib/api";

interface Props {
  searchParams: Promise<{ order?: string; success?: string }>;
}

interface OrderSummary {
  orderNumber: string;
  total: string;
  status: string;
}

async function getOrder(orderNumber: string): Promise<OrderSummary | null> {
  const res = await apiFetch(`/orders/${orderNumber}`);
  if (!res.ok) return null;
  return res.json();
}

// order-success.php gerçek bir sipariş olmadan her zaman anasayfaya
// yönlendirdiği için eski sitenin birebir HTML'i çıkarılamadı - site
// genelindeki .cart-section / .empty-state diliyle tutarlı bir sonuç
// ekranı kuruldu.
export default async function OrderResultPage({ searchParams }: Props) {
  const { order: orderNumber, success } = await searchParams;
  const order = orderNumber ? await getOrder(orderNumber) : null;
  const isSuccess = success === "true" && order !== null;

  return (
    <main className="main-content">
      <section className="cart-section">
        <div className="container">
          <div className="empty-state">
            {isSuccess ? (
              <>
                <i className="fas fa-check-circle" style={{ color: "var(--color-success)" }} />
                <h2>Siparişiniz Alındı</h2>
                <p>
                  Sipariş No: <strong>{order.orderNumber}</strong>
                </p>
                <p className="price-current" style={{ display: "block", marginBottom: "1.5rem" }}>
                  Toplam: {Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                </p>
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
