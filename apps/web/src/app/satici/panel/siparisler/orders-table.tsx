"use client";

import { useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorOrderItem } from "@/lib/types";

const STATUS_LABEL: Record<VendorOrderItem["vendorStatus"], string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const NEXT_ACTION: Partial<Record<VendorOrderItem["vendorStatus"], { label: string; next: string }>> = {
  pending: { label: "Hazırlanıyor Olarak İşaretle", next: "processing" },
  processing: { label: "Kargoya Verildi", next: "shipped" },
  shipped: { label: "Teslim Edildi Olarak İşaretle", next: "delivered" },
};

export default function OrdersTable() {
  const [items, setItems] = useState<VendorOrderItem[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setItems(await fetchJson<VendorOrderItem[]>("/vendor/orders"));
  }

  useEffect(() => {
    load();
  }, []);

  async function advance(item: VendorOrderItem) {
    const action = NEXT_ACTION[item.vendorStatus];
    if (!action) return;
    setBusyId(item.id);
    try {
      await mutateJson(`/vendor/orders/${item.id}`, "PATCH", { status: action.next });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  if (items === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;
  if (items.length === 0) return <p className="empty-state">Henüz ödemesi tamamlanmış bir sipariş yok.</p>;

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Sipariş No</th>
          <th>Ürün</th>
          <th>Adet</th>
          <th>Tutar</th>
          <th>Durum</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const action = NEXT_ACTION[item.vendorStatus];
          return (
            <tr key={item.id}>
              <td>{item.orderNumber}</td>
              <td>{item.productNameSnapshot}</td>
              <td>{item.quantity}</td>
              <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
              <td>
                <span className="badge">{STATUS_LABEL[item.vendorStatus]}</span>
              </td>
              <td style={{ textAlign: "right" }}>
                {action && (
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: "0.8rem" }}
                    disabled={busyId === item.id}
                    onClick={() => advance(item)}
                  >
                    {action.label}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
