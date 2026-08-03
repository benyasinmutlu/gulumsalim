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
      <div className="account-page-header">
        <div className="account-page-header-icon">
          <i className="fas fa-box" />
        </div>
        <div>
          <h3>Siparişlerim</h3>
          <div className="account-page-subtitle">{orders.length > 0 ? `${orders.length} sipariş` : "Sipariş geçmişiniz"}</div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="form-card account-empty-state">
          <i className="fas fa-box-open" />
          <p>Henüz hiç siparişiniz yok.</p>
          <Link href="/urunler" className="btn btn-primary btn-sm">
            Alışverişe Başla
          </Link>
        </div>
      ) : (
        orders.map((order) => {
          const badge = statusBadge(order);
          const extraCount = order.previewImages.length < order.itemCount ? order.itemCount - order.previewImages.length : 0;
          return (
            <div className="order-card" key={order.id}>
              <div className="order-card-header">
                <div className="order-card-header-left">
                  <span className="order-number">#{order.orderNumber}</span>
                  <span className="order-date">{new Date(order.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <span className={`status-badge ${badge.className}`}>{badge.label}</span>
              </div>
              <div className="order-card-body">
                <div className="order-preview-images">
                  {order.previewImages.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt="" />
                  ))}
                  {extraCount > 0 && <div className="order-preview-more">+{extraCount}</div>}
                </div>
                <div className="order-card-info">{order.itemCount} ürün</div>
              </div>
              <div className="order-card-footer">
                <span className="order-total">{Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
                <Link href={`/hesabim/siparisler/${order.orderNumber}`} className="btn btn-sec btn-sm">
                  Detayları Gör <i className="fas fa-arrow-right" style={{ fontSize: 11 }} />
                </Link>
              </div>
            </div>
          );
        })
      )}
    </>
  );
}
