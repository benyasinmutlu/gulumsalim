import { apiFetchJson } from "@/lib/api";
import type { CustomerOrderListItem } from "@/lib/types";

async function getOrders(): Promise<CustomerOrderListItem[]> {
  try {
    return await apiFetchJson<CustomerOrderListItem[]>("/orders");
  } catch {
    return [];
  }
}

const STATUS_LABEL: Record<CustomerOrderListItem["status"], string> = {
  pending: "Onay Bekliyor",
  processing: "Hazırlanıyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal Edildi",
  refunded: "İade Edildi",
};

export default async function CustomerOrdersPage() {
  const orders = await getOrders();

  return (
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
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>{order.orderNumber}</td>
                  <td>{new Date(order.createdAt).toLocaleDateString("tr-TR")}</td>
                  <td>{order.itemCount}</td>
                  <td>{Number(order.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                  <td>
                    <span className={`status-badge status-${order.status}`}>{STATUS_LABEL[order.status]}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
