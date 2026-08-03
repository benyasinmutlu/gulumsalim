"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorOrderItem, VendorRefund } from "@/lib/types";

// bkz. kullanıcı isteği: "100 tane sipariş olduğunda kafası karışmasın" -
// durum filtresi + arama + sayfalama olmadan tek uzun bir tabloda yüzlerce
// satır arasında hazırlanması gereken siparişi bulmak pratik değildi.
const PAGE_SIZE = 15;
const FILTERS = ["Tümü", "pending", "processing", "shipped", "delivered", "cancelled"] as const;

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

// Geciken sipariş tespiti (SLA): yüksek hacimde (günde 100 sipariş) satıcı,
// hangi siparişlere öncelik vermesi gerektiğini tek bakışta görsün. Yalnızca
// aksiyon bekleyen durumlar (pending/processing) izlenir; kargolanan/teslim
// edilen siparişler "zamanında" sayılır.
const SLA_HOURS: Partial<Record<VendorOrderItem["vendorStatus"], { warn: number; over: number }>> = {
  pending: { warn: 12, over: 24 },
  processing: { warn: 24, over: 48 },
};
function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}
function orderUrgency(item: VendorOrderItem): "overdue" | "warning" | "ok" {
  const sla = SLA_HOURS[item.vendorStatus];
  if (!sla) return "ok";
  const h = hoursSince(item.orderCreatedAt);
  if (h >= sla.over) return "overdue";
  if (h >= sla.warn) return "warning";
  return "ok";
}
function ageLabel(iso: string): string {
  const h = hoursSince(iso);
  if (h < 1) return "az önce";
  if (h < 24) return `${Math.floor(h)} saat önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tümü");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [page, setPage] = useState(1);

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

  useEffect(() => {
    setPage(1);
  }, [search, filter, overdueOnly]);

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, total: 0 };
    for (const item of items ?? []) counts[item.vendorStatus] = (counts[item.vendorStatus] ?? 0) + 1;
    counts.total = items?.length ?? 0;
    return counts;
  }, [items]);

  const overdueCount = useMemo(() => (items ?? []).filter((i) => orderUrgency(i) === "overdue").length, [items]);
  const warningCount = useMemo(() => (items ?? []).filter((i) => orderUrgency(i) === "warning").length, [items]);

  const filtered = useMemo(() => {
    if (!items) return null;
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== "Tümü" && item.vendorStatus !== filter) return false;
      if (overdueOnly && orderUrgency(item) === "ok") return false;
      if (!q) return true;
      return (
        item.orderNumber.toLowerCase().includes(q) ||
        item.productNameSnapshot.toLowerCase().includes(q) ||
        item.customerEmail.toLowerCase().includes(q)
      );
    });
  }, [items, search, filter, overdueOnly]);

  const pageCount = filtered ? Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)) : 1;
  const paged = filtered?.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) ?? null;

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
      await load();
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
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function decideRefund(refundId: number, action: "approve" | "reject") {
    setBusyId(refundId);
    try {
      await mutateJson(`/vendor/refunds/${refundId}`, "PATCH", { action, vendorNote: refundNoteDraft.trim() || undefined });
      setRefundNoteDraft("");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function markReceived(refundId: number) {
    setBusyId(refundId);
    try {
      await mutateJson(`/vendor/refunds/${refundId}/received`, "POST");
      await load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      {(overdueCount > 0 || warningCount > 0) && (
        <div className={`alert ${overdueCount > 0 ? "alert-er" : "alert-wa"}`} style={{ marginBottom: 16 }}>
          <i className="fas fa-clock" />
          <span>
            {overdueCount > 0
              ? `${overdueCount} sipariş gecikti — en kısa sürede hazırlayıp kargolayın.`
              : `${warningCount} sipariş süre aşımına yaklaşıyor.`}
          </span>
          <button
            className="btn btn-sm btn-sec"
            style={{ marginLeft: "auto" }}
            type="button"
            onClick={() => {
              setOverdueOnly(true);
              setFilter("Tümü");
            }}
          >
            Gecikenleri göster
          </button>
        </div>
      )}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-shopping-bag" /> Toplam</div>
          <div className="sc-val">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-clock" /> Beklemede</div>
          <div className="sc-val" style={{ color: stats.pending > 0 ? "var(--wa)" : undefined }}>{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-box" /> Hazırlanıyor</div>
          <div className="sc-val" style={{ color: stats.processing > 0 ? "var(--in)" : undefined }}>{stats.processing}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-truck" /> Kargoda</div>
          <div className="sc-val" style={{ color: "var(--pu)" }}>{stats.shipped}</div>
        </div>
        <div className="stat-card">
          <div className="sc-label"><i className="fas fa-circle-check" /> Teslim Edildi</div>
          <div className="sc-val" style={{ color: "var(--ok)" }}>{stats.delivered}</div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Siparişlerim</h3>
        </div>
        <div className="card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingBottom: 0 }}>
          <input
            className="fi"
            style={{ maxWidth: 280 }}
            placeholder="Sipariş no, ürün veya müşteri e-postası ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="row4" style={{ gap: 6 }}>
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`btn btn-sm ${filter === f ? "btn-pr" : "btn-sec"}`}
                onClick={() => setFilter(f)}
                type="button"
              >
                {f === "Tümü" ? "Tümü" : (STATUS_LABEL[f] ?? f)} ({f === "Tümü" ? stats.total : (stats[f] ?? 0)})
              </button>
            ))}
          </div>
          <button
            className={`btn btn-sm ${overdueOnly ? "btn-pr" : "btn-sec"}`}
            onClick={() => setOverdueOnly((v) => !v)}
            type="button"
            title="Sadece aksiyon bekleyen/geciken siparişler"
          >
            <i className="fas fa-triangle-exclamation" /> Geciken{overdueCount + warningCount > 0 ? ` (${overdueCount + warningCount})` : ""}
          </button>
        </div>

        {items === null ? (
          <div className="card-body">Yükleniyor...</div>
        ) : items.length === 0 ? (
          <div className="empty">
            <i className="fas fa-shopping-bag" />
            <p>Henüz ödemesi tamamlanmış bir sipariş yok.</p>
          </div>
        ) : filtered && filtered.length === 0 ? (
          <div className="empty">
            <i className="fas fa-shopping-bag" />
            <p>Bu filtreye uyan bir sipariş yok.</p>
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
                {paged?.map((item) => {
                const action = NEXT_ACTION[item.vendorStatus];
                const refund = refunds.find((r) => r.orderItemId === item.id);
                return (
                  <Fragment key={item.id}>
                    <tr>
                      <td>{item.orderNumber}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {item.productImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.productImageUrl}
                              alt=""
                              style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                            />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 6, background: "var(--s2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <i className="fas fa-image" style={{ color: "var(--tx3)", fontSize: 14 }} />
                            </div>
                          )}
                          <div>
                            <div>{item.productNameSnapshot}</div>
                            {(item.variantSize || item.variantColor) && (
                              <div style={{ fontSize: "0.78rem", color: "var(--tx2)" }}>
                                {[item.variantColor, item.variantSize].filter(Boolean).join(" / ")}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{Number(item.total).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                      <td>
                        <span className={`st st-${STATUS_CLASS[item.vendorStatus]}`}>{STATUS_LABEL[item.vendorStatus]}</span>
                        <div style={{ fontSize: 11, color: "var(--tx3)", marginTop: 4 }}>{ageLabel(item.orderCreatedAt)}</div>
                        {orderUrgency(item) !== "ok" && (
                          <div style={{ marginTop: 2 }}>
                            <span className={`st ${orderUrgency(item) === "overdue" ? "st-danger" : "st-warn"}`}>
                              <i className="fas fa-clock" /> {orderUrgency(item) === "overdue" ? "Gecikti" : "Yaklaşıyor"}
                            </span>
                          </div>
                        )}
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

        {pageCount > 1 && (
          <div className="pagination">
            <button className="btn btn-sec btn-sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <i className="fas fa-chevron-left" />
            </button>
            <span style={{ fontSize: "0.85rem", color: "var(--tx2)", padding: "0 8px", display: "flex", alignItems: "center" }}>
              Sayfa {page} / {pageCount}
            </span>
            <button className="btn btn-sec btn-sm" disabled={page === pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
