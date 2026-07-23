"use client";

import { Fragment, useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorOrderItem, VendorRefund } from "@/lib/types";

const REFUND_STATUS_LABEL: Record<VendorRefund["status"], string> = {
  pending: "İade Bekliyor",
  approved: "İade Onaylandı",
  rejected: "İade Reddedildi",
};

const REFUND_STATUS_CLASS: Record<VendorRefund["status"], string> = {
  pending: "warn",
  approved: "success",
  rejected: "danger",
};

const STATUS_LABEL: Record<VendorOrderItem["vendorStatus"], string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const STATUS_CLASS: Record<VendorOrderItem["vendorStatus"], string> = {
  pending: "warn",
  processing: "info",
  shipped: "purple",
  delivered: "success",
  cancelled: "danger",
};

const NEXT_ACTION: Partial<Record<VendorOrderItem["vendorStatus"], { label: string; next: string }>> = {
  pending: { label: "Hazırlanıyor Olarak İşaretle", next: "processing" },
  processing: { label: "Kargoya Verildi", next: "shipped" },
  shipped: { label: "Teslim Edildi Olarak İşaretle", next: "delivered" },
};

export default function OrdersTable() {
  const [items, setItems] = useState<VendorOrderItem[] | null>(null);
  const [refunds, setRefunds] = useState<VendorRefund[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [refundDraftId, setRefundDraftId] = useState<number | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  async function load() {
    const [orderItems, refundRows] = await Promise.all([
      fetchJson<VendorOrderItem[]>("/vendor/orders"),
      fetchJson<VendorRefund[]>("/vendor/refunds"),
    ]);
    setItems(orderItems);
    setRefunds(refundRows);
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

  async function submitRefundRequest(itemId: number) {
    const reason = refundReason.trim();
    if (reason.length < 5) return;
    setBusyId(itemId);
    try {
      await mutateJson(`/vendor/orders/${itemId}/refund-request`, "POST", { reason });
      setRefundDraftId(null);
      setRefundReason("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Siparişlerim</h3>
      </div>
      {items === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : items.length === 0 ? (
        <div className="empty">
          <i className="fas fa-shopping-bag" />
          <p>Henüz ödemesi tamamlanmış bir sipariş yok.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
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
                const refund = refunds.find((r) => r.orderItemId === item.id);
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.orderNumber}</td>
                      <td>{item.productNameSnapshot}</td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                      <td>
                        <span className={`st st-${STATUS_CLASS[item.vendorStatus]}`}>{STATUS_LABEL[item.vendorStatus]}</span>
                        {refund && (
                          <div style={{ marginTop: 4 }}>
                            <span className={`st st-${REFUND_STATUS_CLASS[refund.status]}`}>
                              {REFUND_STATUS_LABEL[refund.status]}
                            </span>
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-sec btn-sm"
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        >
                          {expandedId === item.id ? "Gizle" : "Detay"}
                        </button>
                        {action && (
                          <button className="btn btn-sec btn-sm" style={{ marginLeft: 6 }} disabled={busyId === item.id} onClick={() => advance(item)}>
                            {action.label}
                          </button>
                        )}
                        {!refund && (
                          <button
                            className="btn btn-sec btn-sm"
                            style={{ marginLeft: 6 }}
                            disabled={busyId === item.id}
                            onClick={() => {
                              setRefundDraftId(refundDraftId === item.id ? null : item.id);
                              setRefundReason("");
                            }}
                          >
                            İade Talebi
                          </button>
                        )}
                      </td>
                    </tr>
                    {expandedId === item.id && (
                      <tr>
                        <td colSpan={6}>
                          <div className="row2" style={{ fontSize: "0.85rem", padding: "8px 0" }}>
                            <div>
                              <strong>Teslimat Adresi</strong>
                              <p style={{ marginTop: 4 }}>
                                {item.shippingAddress.fullName} — {item.shippingAddress.phone}
                                <br />
                                {item.shippingAddress.addressLine}, {item.shippingAddress.district}/{item.shippingAddress.city}
                                {item.shippingAddress.zipCode ? ` (${item.shippingAddress.zipCode})` : ""}
                              </p>
                            </div>
                            <div>
                              <strong>Müşteri</strong>
                              <p style={{ marginTop: 4 }}>{item.customerEmail}</p>
                              {item.orderNote && (
                                <>
                                  <strong>Sipariş Notu</strong>
                                  <p style={{ marginTop: 4 }}>{item.orderNote}</p>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {refundDraftId === item.id && (
                      <tr>
                        <td colSpan={6}>
                          <textarea
                            className="fi"
                            rows={2}
                            placeholder="İade sebebini yazın..."
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                          />
                          <button
                            className="btn btn-pr btn-sm"
                            style={{ marginTop: 8 }}
                            disabled={busyId === item.id || refundReason.trim().length < 5}
                            onClick={() => submitRefundRequest(item.id)}
                          >
                            {busyId === item.id ? "Gönderiliyor..." : "İade Talebini Gönder"}
                          </button>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
