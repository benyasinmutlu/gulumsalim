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

export default async function OrderResultPage({ searchParams }: Props) {
  const { order: orderNumber, success } = await searchParams;
  const order = orderNumber ? await getOrder(orderNumber) : null;
  const isSuccess = success === "true" && order !== null;

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      {isSuccess ? (
        <>
          <h1 style={{ fontSize: "1.3rem" }}>Siparişiniz alındı 🎉</h1>
          <p style={{ marginTop: "0.75rem" }}>
            Sipariş No: <strong>{order.orderNumber}</strong>
          </p>
          <p style={{ marginTop: "0.4rem" }} className="price">
            Toplam: {Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
          </p>
        </>
      ) : (
        <>
          <h1 style={{ fontSize: "1.3rem" }}>Ödeme tamamlanamadı</h1>
          <p style={{ marginTop: "0.75rem" }}>
            Sepetiniz korunuyor olabilir, lütfen tekrar deneyin veya bizimle iletişime geçin.
          </p>
        </>
      )}
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/urunler" className="btn btn-secondary">
          Alışverişe devam et
        </Link>
      </p>
    </main>
  );
}
