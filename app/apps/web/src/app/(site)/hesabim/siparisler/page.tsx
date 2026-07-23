import Link from "next/link";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { CustomerOrderListItem, PendingReviewItem } from "@/lib/types";
import PendingReviewsPrompt from "./pending-reviews-prompt";

export const metadata: Metadata = { title: "Siparişlerim | Gülüm Şalım" };

async function getOrders(): Promise<CustomerOrderListItem[]> {
  try {
    return await apiFetchJson<CustomerOrderListItem[]>("/orders");
  } catch {
    return [];
  }
}

// bkz. kullanıcı isteği: "müşterinin aldığı ürünlere yıldız ve yorum
// yapmaya itelim" - teslim alınmış ama henüz değerlendirilmemiş ürünler.
async function getPendingReviews(): Promise<PendingReviewItem[]> {
  try {
    return await apiFetchJson<PendingReviewItem[]>("/my/pending-reviews");
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<CustomerOrderListItem["status"], string> = {
  pending: "Ödeme Bekleniyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

// Ödeme başarısız olduğunda order.status hâlâ "pending" kalır (bkz.
// order.repository.ts markOrderPaymentFailed) - bu da müşteriye yanıltıcı
// biçimde "Ödeme Bekleniyor" gösterirdi. paymentStatus === "failed" burada
// ayrı ve doğru bir etiketle işaretlenir.
function statusBadge(order: CustomerOrderListItem) {
  if (order.paymentStatus === "failed") {
    return { label: "Ödeme Başarısız", className: "status-failed" };
  }
  return { label: STATUS_LABEL[order.status], className: `status-${order.status}` };
}

export default async function CustomerOrdersPage() {
  const [orders, pendingReviews] = await Promise.all([getOrders(), getPendingReviews()]);

  return (
    <>
      <PendingReviewsPrompt items={pendingReviews} />
      <div className="form-card">
      <h3>Siparişlerim</h3>
      {orders.length === 0 ? (
        <p style={{ fontSize: "0.9rem" }}>Henüz hiç siparişiniz yok.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="orders-table">
            <thead>
              <tr>
                <th>Sipariş No</th>
                <th>Tarih</th>
                <th>Ürün Sayısı</th>
                <th>Tutar</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const badge = statusBadge(order);
                return (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/hesabim/siparisler/${order.orderNumber}`}>{order.orderNumber}</Link>
                    </td>
                    <td>{new Date(order.createdAt).toLocaleDateString("tr-TR")}</td>
                    <td>{order.itemCount}</td>
                    <td>{Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                    <td>
                      <span className={`status-badge ${badge.className}`}>{badge.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}
