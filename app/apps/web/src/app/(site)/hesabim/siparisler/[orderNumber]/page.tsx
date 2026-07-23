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
      <p style={{ marginBottom: 12 }}>
        <Link href="/hesabim/siparisler">&larr; Siparişlerim</Link>
      </p>
      <h3>Sipariş #{order.orderNumber}</h3>
      <p style={{ margin: "8px 0" }}>
        <span className={`status-badge ${badge.className}`}>{badge.label}</span>
      </p>
      <p style={{ marginBottom: 8 }}>
        <strong>Teslimat Adresi:</strong> {addressLine || "—"}
      </p>
      {order.orderNote && (
        <p style={{ marginBottom: 8 }}>
          <strong>Sipariş Notu:</strong> {order.orderNote}
        </p>
      )}
      <div style={{ overflowX: "auto", marginTop: 16 }}>
        <table className="orders-table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Satıcı</th>
              <th>Adet</th>
              <th>Tutar</th>
              <th>Durum</th>
              <th>Kargo</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id}>
                <td>{item.productNameSnapshot}</td>
                <td style={{ fontSize: "0.85rem" }}>{item.vendorStoreName}</td>
                <td>{item.quantity}</td>
                <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                <td>{ITEM_STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}</td>
                <td style={{ fontSize: "0.8rem" }}>{item.trackingNumber ? `${item.trackingCarrier} — ${item.trackingNumber}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.items.some((item) => item.vendorStatus === "delivered") && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: "1rem", marginBottom: 10 }}>İade İşlemleri</h4>
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

      <div style={{ marginTop: 16, fontSize: "0.9rem" }}>
        <p>Ara Toplam: {Number(order.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</p>
        <p>Kargo: {Number(order.shippingFee).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</p>
        <p style={{ fontWeight: 600 }}>Toplam: {Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</p>
      </div>
    </div>
  );
}
