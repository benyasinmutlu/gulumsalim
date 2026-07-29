"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorOrderItem, VendorOrderStats, VendorRefund } from "@/lib/types";

const CARRIER_OPTIONS = ["Yurtiçi Kargo", "Aras Kargo", "MNG Kargo", "PTT Kargo", "Sürat Kargo", "UPS", "DHL", "FedEx", "Diğer"];

const REFUND_STATUS_LABEL: Record<VendorRefund["status"], string> = {
  pending: "İade Bekliyor (karar sizde)",
  approved: "Onaylandı, kargo bekleniyor",
  rejected: "İade Reddedildi",
  item_received: "Ürün Teslim Alındı",
  refunded: "Para İade Edildi",
};

const REFUND_STATUS_CLASS: Record<VendorRefund["status"], string> = {
  pending: "warn",
  approved: "info",
  rejected: "danger",
  item_received: "purple",
  refunded: "success",
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
  processing: { label: "Kargoya Ver", next: "shipped" },
  shipped: { label: "Teslim Edildi Olarak İşaretle", next: "delivered" },
};

export default function OrdersTable() {
  const [items, setItems] = useState<VendorOrderItem[] | null>(null);
  const [refunds, setRefunds] = useState<VendorRefund[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [shippingDraftId, setShippingDraftId] = useState<number | null>(null);
  const [carrier, setCarrier] = useState(CARRIER_OPTIONS[0]);
  const [customCarrier, setCustomCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [refundNoteDraft, setRefundNoteDraft] = useState("");
  const [stats, setStats] = useState<VendorOrderStats | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (sort) params.set("sort", sort);
    const qs = params.toString();
    const [orderItems, refundRows] = await Promise.all([
      fetchJson<VendorOrderItem[]>(`/vendor/orders${qs ? `?${qs}` : ""}`),
      fetchJson<VendorRefund[]>("/vendor/refunds"),
    ]);
    setItems(orderItems);
    setRefunds(refundRows);
  }, [debouncedSearch, statusFilter, sort]);

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchJson<VendorOrderStats>("/vendor/orders/stats"));
    } catch {
      // Özet analiz opsiyonel - liste yine de gösterilir.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const hasFilters = Boolean(debouncedSearch.trim() || statusFilter);

  async function advance(item: VendorOrderItem) {
    const action = NEXT_ACTION[item.vendorStatus];
    if (!action) return;
    // bkz. kullanıcı isteği: "satıcı takip kodunu sisteme girecek" -
    // "shipped"e geçerken önce kargo bilgisi formu açılır, aksiyon
    // buradan değil formun "Kargoya Verildi Olarak Kaydet" butonundan tetiklenir.
    if (action.next === "shipped") {
      setShippingDraftId(item.id);
      setCarrier(CARRIER_OPTIONS[0]);
      setCustomCarrier("");
      setTrackingNumber("");
      return;
    }
    setBusyId(item.id);
    try {
      await mutateJson(`/vendor/orders/${item.id}`, "PATCH", { status: action.next });
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  async function confirmShipping(itemId: number) {
    const resolvedCarrier = carrier === "Diğer" ? customCarrier.trim() : carrier;
    if (!resolvedCarrier || !trackingNumber.trim()) return;
    setBusyId(itemId);
    try {
      await mutateJson(`/vendor/orders/${itemId}`, "PATCH", {
        status: "shipped",
        trackingCarrier: resolvedCarrier,
        trackingNumber: trackingNumber.trim(),
      });
      setShippingDraftId(null);
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  async function decideRefund(refundId: number, action: "approve" | "reject") {
    setBusyId(refundId);
    try {
      await mutateJson(`/vendor/refunds/${refundId}`, "PATCH", { action, vendorNote: refundNoteDraft.trim() || undefined });
      setRefundNoteDraft("");
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(refundId: number) {
    setBusyId(refundId);
    try {
      await mutateJson(`/vendor/refunds/${refundId}/received`, "POST");
      await Promise.all([load(), loadStats()]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {stats && (
        <div className="stat-chips">
          <div className="chip">
            <span className="chip-val">{stats.total}</span>
            <span className="chip-lbl">Toplam Sipariş</span>
          </div>
          <div className="chip chip-wa">
            <span className="chip-val">{stats.pending}</span>
            <span className="chip-lbl">Beklemede</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.processing}</span>
            <span className="chip-lbl">Hazırlanıyor</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.shipped}</span>
            <span className="chip-lbl">Kargoda</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.delivered}</span>
            <span className="chip-lbl">Teslim Edildi</span>
          </div>
          <div className="chip">
            <span className="chip-val">{stats.revenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</span>
            <span className="chip-lbl">Ciro (teslim edilen)</span>
          </div>
        </div>
      )}

      <div className="card">
        <div className="ch">
          <h3>Siparişlerim</h3>
        </div>

        <div className="toolbar">
          <div className="toolbar-search">
            <i className="fas fa-search" />
            <input
              className="fi"
              type="search"
              placeholder="Sipariş no, ürün veya müşteri ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="fi" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Durum filtresi">
            <option value="">Tüm Durumlar</option>
            <option value="pending">Beklemede</option>
            <option value="processing">Hazırlanıyor</option>
            <option value="shipped">Kargoda</option>
            <option value="delivered">Teslim Edildi</option>
            <option value="cancelled">İptal</option>
          </select>
          <select className="fi" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
            <option value="newest">En Yeni</option>
            <option value="oldest">En Eski</option>
          </select>
        </div>

        {items === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="empty">
            <i className="fas fa-shopping-bag" />
            <p>{hasFilters ? "Bu filtrelere uygun sipariş bulunamadı." : "Henüz ödemesi tamamlanmış bir sipariş yok."}</p>
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
                              {item.trackingCarrier && (
                                <>
                                  <strong>Kargo</strong>
                                  <p style={{ marginTop: 4 }}>
                                    {item.trackingCarrier} — {item.trackingNumber}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>

                          {refund && (
                            <div style={{ borderTop: "1px solid #eee", marginTop: 8, paddingTop: 8, fontSize: "0.85rem" }}>
                              <strong>İade Talebi:</strong> {refund.reason}
                              {refund.photos.length > 0 && (
                                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                                  {refund.photos.map((p) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <a key={p} href={p} target="_blank" rel="noreferrer">
                                      <img src={p} alt="İade fotoğrafı" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                                    </a>
                                  ))}
                                </div>
                              )}

                              {refund.status === "pending" && (
                                <div style={{ marginTop: 8 }}>
                                  <textarea
                                    className="fi"
                                    rows={2}
                                    placeholder="Müşteriye not (opsiyonel)..."
                                    value={refundNoteDraft}
                                    onChange={(e) => setRefundNoteDraft(e.target.value)}
                                  />
                                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                    <button className="btn btn-pr btn-sm" disabled={busyId === refund.id} onClick={() => decideRefund(refund.id, "approve")}>
                                      İadeyi Onayla
                                    </button>
                                    <button className="btn btn-sec btn-sm" disabled={busyId === refund.id} onClick={() => decideRefund(refund.id, "reject")}>
                                      Reddet
                                    </button>
                                  </div>
                                </div>
                              )}

                              {refund.status === "approved" && (
                                <p style={{ marginTop: 8 }}>
                                  {refund.returnTrackingNumber ? (
                                    <>
                                      Müşteri kargoladı: <strong>{refund.returnTrackingCarrier} — {refund.returnTrackingNumber}</strong>
                                      <br />
                                      <button className="btn btn-pr btn-sm" style={{ marginTop: 6 }} disabled={busyId === refund.id} onClick={() => markReceived(refund.id)}>
                                        Ürünü Teslim Aldım
                                      </button>
                                    </>
                                  ) : (
                                    "Müşterinin ürünü kargolayıp takip kodu girmesi bekleniyor."
                                  )}
                                  {!refund.returnTrackingNumber && (
                                    <>
                                      <br />
                                      <button className="btn btn-sec btn-sm" style={{ marginTop: 6 }} disabled={busyId === refund.id} onClick={() => markReceived(refund.id)}>
                                        Ürünü Yine de Teslim Aldım
                                      </button>
                                    </>
                                  )}
                                </p>
                              )}

                              {refund.status === "item_received" && <p style={{ marginTop: 8 }}>Ürün teslim alındı, admin para iadesini bekliyor.</p>}
                              {refund.status === "refunded" && <p style={{ marginTop: 8 }}>Müşteriye para iadesi tamamlandı.</p>}
                              {refund.vendorNote && (
                                <p style={{ marginTop: 8 }}>
                                  <strong>Notunuz:</strong> {refund.vendorNote}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                    {shippingDraftId === item.id && (
                      <tr>
                        <td colSpan={6}>
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", padding: "8px 0" }}>
                            <div>
                              <label style={{ fontSize: "0.75rem", display: "block", marginBottom: 4 }}>Kargo Firması</label>
                              <select className="fi" value={carrier} onChange={(e) => setCarrier(e.target.value)}>
                                {CARRIER_OPTIONS.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {carrier === "Diğer" && (
                              <div>
                                <label style={{ fontSize: "0.75rem", display: "block", marginBottom: 4 }}>Firma Adı</label>
                                <input className="fi" value={customCarrier} onChange={(e) => setCustomCarrier(e.target.value)} />
                              </div>
                            )}
                            <div>
                              <label style={{ fontSize: "0.75rem", display: "block", marginBottom: 4 }}>Takip Numarası</label>
                              <input className="fi" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} />
                            </div>
                            <button
                              className="btn btn-pr btn-sm"
                              disabled={busyId === item.id || !trackingNumber.trim() || (carrier === "Diğer" && !customCarrier.trim())}
                              onClick={() => confirmShipping(item.id)}
                            >
                              {busyId === item.id ? "Kaydediliyor..." : "Kargoya Verildi Olarak Kaydet"}
                            </button>
                            <button className="btn btn-sec btn-sm" onClick={() => setShippingDraftId(null)}>
                              Vazgeç
                            </button>
                          </div>
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
    </div>
  );
}
