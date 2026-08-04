import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetchJson, ApiError } from "@/lib/api";
import type { CustomerOrderDetail, CustomerRefund } from "@/lib/types";
import RefundSection from "./refund-section";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export const metadata: Metadata = { title: "Sipariş Detayı | Gülüm Şalım" };

// Sipariş genelindeki "pending" gerçekten ödeme bekliyor demektir (bkz.
// order.repository.ts markOrderPaid - ödeme başarılı olana kadar order.status
// "pending" kalır). Ama bir KALEMİN (order_items.vendorStatus) "pending"i
// tamamen farklı bir şey ifade eder: ödeme zaten tamamlanmış, sadece satıcı
// henüz hazırlamaya başlamamış. İkisi için AYNI etiket kullanmak ("Ödeme
// Bekleniyor" bir kalem satırında), ödemesi tamamlanmış bir siparişte bile
// yanlışlıkla "ödeme bekleniyor" gösterip müşteriyi yanıltıyordu - bkz.
// kullanıcı geri bildirimi: "ödeme bekleniyor diyor ama bi yandan da teslim
// edildi diyor".
const STATUS_LABEL: Record<string, string> = {
  pending: "Ödeme Bekleniyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

const ITEM_STATUS_LABEL: Record<string, string> = {
  pending: "Hazırlanmayı Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

async function getOrder(orderNumber: string): Promise<CustomerOrderDetail | null> {
  try {
    return await apiFetchJson<CustomerOrderDetail>(`/orders/${orderNumber}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getRefunds(): Promise<CustomerRefund[]> {
  try {
    return await apiFetchJson<CustomerRefund[]>("/refunds");
  } catch {
    return [];
  }
}

export default async function CustomerOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const [order, refunds] = await Promise.all([getOrder(orderNumber), getRefunds()]);
  if (!order) notFound();

  const addr = order.shippingAddress as Record<string, unknown>;
  const addressLine = [addr?.fullName, addr?.addressLine, addr?.district, addr?.city, addr?.phone]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(", ");

  const badge =
    order.paymentStatus === "failed"
      ? { label: "Ödeme Başarısız", className: "status-failed" }
      : { label: STATUS_LABEL[order.status] ?? order.status, className: `status-${order.status}` };

  return (
    <div className="form-card">
      <Link href="/hesabim/siparisler" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 16 }}>
        <i className="fas fa-arrow-left" /> Siparişlerim
      </Link>

      <div className="order-card-header" style={{ borderRadius: "var(--radius-md)", border: "1px solid var(--color-border-light)", marginBottom: 16 }}>
        <div className="order-card-header-left">
          <span className="order-number">Sipariş #{order.orderNumber}</span>
          <span className="order-date">{new Date(order.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
        <span className={`status-badge ${badge.className}`}>{badge.label}</span>
      </div>

      <div className="order-info-block">
        <i className="fas fa-location-dot" />
        <div>
          <strong>Teslimat Adresi</strong>
          <div>{addressLine || "—"}</div>
        </div>
      </div>

      {order.orderNote && (
        <div className="order-info-block">
          <i className="fas fa-note-sticky" />
          <div>
            <strong>Sipariş Notu</strong>
            <div>{order.orderNote}</div>
          </div>
        </div>
      )}

      <h4 style={{ fontSize: 15, margin: "20px 0 4px" }}>Ürünler</h4>
      <div>
        {order.items.map((item) => (
          <div className="order-item-row" key={item.id}>
            {item.productImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="order-item-image" src={item.productImage} alt="" />
            ) : (
              <div className="order-item-image-placeholder">
                <i className="fas fa-shirt" />
              </div>
            )}
            <div className="order-item-info">
              <Link href={`/urun/${item.productSlug}`} className="order-item-name" style={{ color: "inherit", textDecoration: "none" }}>
                {item.productNameSnapshot}
              </Link>
              <div className="order-item-meta">
                {item.vendorStoreName} · {item.quantity} adet ·{" "}
                <span className={`status-badge status-${item.vendorStatus}`} style={{ padding: "2px 10px", fontSize: 11 }}>
                  {ITEM_STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}
                </span>
              </div>
              {item.trackingNumber && (
                <div className="order-item-tracking">
                  <i className="fas fa-truck" /> {item.trackingCarrier} — {item.trackingNumber}
                </div>
              )}
            </div>
            <div className="order-item-price">{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
          </div>
        ))}
      </div>

      {order.items.some((item) => item.vendorStatus === "delivered") && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ fontSize: 15, marginBottom: 10 }}>İade İşlemleri</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {order.items
              .filter((item) => item.vendorStatus === "delivered")
              .map((item) => (
                <div key={item.id}>
                  <p style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 6 }}>{item.productNameSnapshot}</p>
                  <RefundSection orderItemId={item.id} initialRefund={refunds.find((r) => r.orderItemId === item.id) ?? null} />
                </div>
              ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: 20, maxWidth: 320, marginLeft: "auto" }}>
        <div className="order-summary-row">
          <span>Ara Toplam</span>
          <span>{Number(order.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
        </div>
        <div className="order-summary-row">
          <span>Kargo</span>
          <span>{Number(order.shippingFee).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
        </div>
        <div className="order-summary-row total">
          <span>Toplam</span>
          <span>{Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
        </div>
      </div>
    </div>
  );
}
