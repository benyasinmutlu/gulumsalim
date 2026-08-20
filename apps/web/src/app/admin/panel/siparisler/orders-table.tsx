"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { AdminOrderDetail, AdminOrderRow } from "@/lib/types";

const STATUS_LABEL: Record<string, string> = {
  pending: "Beklemede",
  processing: "Hazırlanıyor",
  shipped: "Kargoda",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
  refunded: "İade Edildi",
};

// order_items.vendorStatus "pending"i sipariş genelindeki "pending"den farklı
// anlama gelir (bkz. hesabim/siparisler/[orderNumber]/page.tsx ITEM_STATUS_LABEL
// yorumu) - aynı Türkçe karşılık ("Beklemede") burada zaten uygun olduğundan
// metin aynı ama kavramsal olarak ayrı tutulduğu belirtiliyor.
const ITEM_STATUS_LABEL = STATUS_LABEL;

const STATUS_CLASS: Record<string, string> = {
  pending: "pending",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
  refunded: "inactive",
};

const FILTERS = ["Tümü", "pending", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;

// Sipariş ilerleme hattı (CRM'lerdeki "deal stage" çubuğunun karşılığı) -
// sadece GERÇEK verisi olan aşamalar bir tarih taşır (createdAt, en erken
// shippedAt); teslim tarihi ayrı bir alan olarak tutulmadığı için uydurulmaz.
const PIPELINE = [
  { key: "pending", label: "Sipariş Alındı", icon: "fa-receipt" },
  { key: "processing", label: "Hazırlanıyor", icon: "fa-box" },
  { key: "shipped", label: "Kargoda", icon: "fa-truck" },
  { key: "delivered", label: "Teslim Edildi", icon: "fa-circle-check" },
] as const;

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoney(value: string) {
  return Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 2 }) + " ₺";
}

// bkz. kullanıcı isteği: "ürünü hazırlama kargolama iptal ve iade işlemleri
// satıcıda olmalı" - bu sayfa artık SALT OKUNUR bir genel bakış. Admin
// burada durum değiştiremez (önceki denetimde tespit edilen mantık hatası:
// admin panel satıcının işini tekrarlıyordu) - genel durum satıcıların
// kendi kalem durumlarından otomatik hesaplanır (bkz. order.repository.ts
// recomputeOrderStatus). İade/para akışı ayrı bir sayfada (bkz.
// admin/panel/iadeler).
//
// bkz. kullanıcı isteği: "siparişler sayfasının tasarımını crm dashboard
// gibi yap" - ikon istatistik kartları (admin dashboard'daki .admin-fin-stat
// ile aynı dil), sayaçlı durum filtreleri, avatarlı müşteri hücreleri ve
// satır detayının artık tablonun altına gömülü değil sağdan açılan bir
// panelde (slide-over) gösterilmesi - çoğu CRM'de kayıt detayı bu şekilde
// açılır.
export default function OrdersTable() {
  const [orders, setOrders] = useState<AdminOrderRow[] | null>(null);
  const [selected, setSelected] = useState<AdminOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Tümü");

  async function load() {
    setOrders(await fetchJson<AdminOrderRow[]>("/admin/orders"));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!selected) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  async function openDetail(id: number) {
    setDetailLoading(true);
    try {
      setSelected(await fetchJson<AdminOrderDetail>(`/admin/orders/${id}`));
    } finally {
      setDetailLoading(false);
    }
  }

  const stats = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, processing: 0, shipped: 0, delivered: 0, cancelled: 0, refunded: 0, total: 0 };
    let revenue = 0;
    for (const o of orders ?? []) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
      if (o.status !== "cancelled") revenue += Number(o.total);
    }
    counts.total = orders?.length ?? 0;
    return { counts, revenue };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return null;
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (filter !== "Tümü" && o.status !== filter) return false;
      if (!q) return true;
      return o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q) || o.customerEmail.toLowerCase().includes(q);
    });
  }, [orders, search, filter]);

  const isTerminalBad = selected?.status === "cancelled" || selected?.status === "refunded";
  const pipelineIndex = selected ? PIPELINE.findIndex((p) => p.key === selected.status) : -1;
  const earliestShippedAt = selected
    ? selected.items.reduce<string | null>((min, item) => {
        if (!item.shippedAt) return min;
        return !min || item.shippedAt < min ? item.shippedAt : min;
      }, null)
    : null;

  return (
    // bkz. kullanıcı isteği: "siparişler bölümü sayfanın tam ortasında olsun
    // onun üstünde 5 küçük kutu gözüksün bu altında siparişler gözüksün" -
    // önceki halde yanlışlıkla .admin-form-row (2 sütunlu FORM grid'i) sarmalayıcı
    // olarak kullanılmıştı, bu da istatistik kutularıyla sipariş kartını yan yana
    // iki sütuna böldürüyordu. Burada dikey istiflenen, ortalanmış tek sütun var.
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div className="admin-fin-stats">
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "var(--admin-primary-light)", color: "var(--admin-primary)" }}>
            <i className="fas fa-shopping-bag" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{stats.counts.total}</div>
            <div className="lbl">Toplam Sipariş</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "var(--admin-accent-light)", color: "var(--admin-accent)" }}>
            <i className="fas fa-lira-sign" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{stats.revenue.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
            <div className="lbl">Toplam Ciro</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(201,138,0,.12)", color: "var(--admin-warning)" }}>
            <i className="fas fa-clock" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{stats.counts.pending}</div>
            <div className="lbl">Bekleyen</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(147,51,234,.12)", color: "var(--admin-purple)" }}>
            <i className="fas fa-truck" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{stats.counts.shipped}</div>
            <div className="lbl">Kargoda</div>
          </div>
        </div>
        <div className="admin-fin-stat">
          <div className="admin-fin-stat-icon" style={{ background: "rgba(11,163,107,.12)", color: "var(--admin-success)" }}>
            <i className="fas fa-circle-check" />
          </div>
          <div className="admin-fin-stat-body">
            <div className="val">{stats.counts.delivered}</div>
            <div className="lbl">Teslim Edildi</div>
          </div>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Siparişler</h2>
        </div>
        <div className="admin-card-body" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", paddingBottom: 0 }}>
          <div style={{ position: "relative", maxWidth: 280, flex: 1, minWidth: 200 }}>
            <i className="fas fa-search" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--admin-text-muted)", fontSize: 13 }} />
            <input
              className="admin-form-control"
              style={{ paddingLeft: 32 }}
              placeholder="Sipariş no, müşteri adı veya e-posta ara…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="quick-actions">
            {FILTERS.map((f) => (
              <button
                key={f}
                className={`admin-btn ${filter === f ? "admin-btn-primary" : "admin-btn-secondary"}`}
                onClick={() => setFilter(f)}
                type="button"
              >
                <span className="order-filter-pill">
                  {f === "Tümü" ? "Tümü" : (STATUS_LABEL[f] ?? f)}
                  <span className="cnt">{f === "Tümü" ? stats.counts.total : (stats.counts[f] ?? 0)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {orders === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : filtered && filtered.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-shopping-bag" />
            <h3>Sipariş bulunamadı</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Sipariş No</th>
                  <th>Müşteri</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {filtered?.map((o) => (
                  <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => openDetail(o.id)}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDetail(o.id); }}>
                        {o.orderNumber}
                      </a>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div className="customer-avatar">{initials(o.customerName)}</div>
                        <div style={{ fontSize: "0.85rem" }}>
                          {o.customerName}
                          <br />
                          <span style={{ color: "var(--admin-text-muted)" }}>{o.customerEmail}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatMoney(o.total)}</td>
                    <td>
                      <span className={`admin-badge admin-badge-${STATUS_CLASS[o.status] ?? "pending"}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{formatDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={`order-slideover-backdrop${selected ? " show" : ""}`} onClick={() => setSelected(null)} />
      <div className={`order-slideover${selected ? " show" : ""}`}>
        {selected && (
          <>
            <div className="order-slideover-header">
              <div>
                <h2>Sipariş #{selected.orderNumber}</h2>
                <span className={`admin-badge admin-badge-${STATUS_CLASS[selected.status] ?? "pending"}`} style={{ marginTop: 6, display: "inline-block" }}>
                  {STATUS_LABEL[selected.status] ?? selected.status}
                </span>
              </div>
              <button className="order-slideover-close" onClick={() => setSelected(null)} type="button" aria-label="Kapat">
                <i className="fas fa-xmark" />
              </button>
            </div>

            <div className="order-slideover-body">
              <div className="order-slideover-section">
                <h3>Müşteri</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div className="customer-avatar" style={{ width: 42, height: 42, fontSize: 15 }}>{initials(selected.customerName)}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{selected.customerName}</div>
                    <div style={{ fontSize: 12.5, color: "var(--admin-text-muted)" }}>{selected.customerEmail}</div>
                  </div>
                </div>
              </div>

              <div className="order-slideover-section">
                <h3>Durum</h3>
                {isTerminalBad ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="timeline-dot active" style={{ background: "var(--admin-error)", borderColor: "var(--admin-error)" }}>
                      <i className={`fas ${selected.status === "cancelled" ? "fa-xmark" : "fa-rotate-left"}`} />
                    </div>
                    <span style={{ fontSize: 13.5 }}>Bu sipariş {STATUS_LABEL[selected.status]?.toLocaleLowerCase("tr-TR")}.</span>
                  </div>
                ) : (
                  <div className="order-timeline">
                    {PIPELINE.map((stage, i) => {
                      const active = i <= pipelineIndex;
                      const dateLabel = stage.key === "pending" ? formatDate(selected.createdAt) : stage.key === "shipped" && earliestShippedAt ? formatDate(earliestShippedAt) : null;
                      return (
                        <div className="timeline-item" key={stage.key}>
                          <div className={`timeline-dot${active ? " active" : ""}`}>
                            <i className={`fas ${stage.icon}`} />
                          </div>
                          <div className="timeline-content">
                            <h4>{stage.label}</h4>
                            {dateLabel && <p>{dateLabel}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="order-slideover-section">
                <h3>Ödeme</h3>
                <p style={{ fontSize: 13.5 }}>{selected.paymentProvider} — {selected.paymentStatus}</p>
              </div>

              <div className="order-slideover-section">
                <h3>Teslimat Adresi</h3>
                <p style={{ fontSize: 13.5 }}>
                  {(() => {
                    const addr = selected.shippingAddress as Record<string, unknown>;
                    return [addr?.fullName, addr?.addressLine, addr?.district, addr?.city, addr?.phone]
                      .filter((v): v is string => typeof v === "string" && v.length > 0)
                      .join(", ");
                  })()}
                </p>
              </div>

              {selected.orderNote && (
                <div className="order-slideover-section">
                  <h3>Müşteri Notu</h3>
                  <p style={{ fontSize: 13.5 }}>{selected.orderNote}</p>
                </div>
              )}

              <div className="order-slideover-section">
                <h3>Sipariş Özeti</h3>
                <div className="order-summary-row">
                  <span>Ara Toplam</span>
                  <span>{formatMoney(selected.subtotal)}</span>
                </div>
                <div className="order-summary-row">
                  <span>Kargo</span>
                  <span>{formatMoney(selected.shippingFee)}</span>
                </div>
                <div className="order-summary-row total">
                  <span>Toplam</span>
                  <span>{formatMoney(selected.total)}</span>
                </div>
              </div>

              <div className="order-slideover-section" style={{ marginBottom: 0 }}>
                <h3>Ürünler</h3>
                <div style={{ overflowX: "auto" }}>
                  <table className="admin-table">
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
                      {selected.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.productNameSnapshot}</td>
                          <td style={{ fontSize: "0.85rem" }}>{item.vendorStoreName}</td>
                          <td>{item.quantity}</td>
                          <td>{formatMoney(item.total)}</td>
                          <td>{ITEM_STATUS_LABEL[item.vendorStatus] ?? item.vendorStatus}</td>
                          <td style={{ fontSize: "0.8rem" }}>{item.trackingNumber ? `${item.trackingCarrier} — ${item.trackingNumber}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
        {detailLoading && !selected && (
          <div className="order-slideover-body" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
            Yükleniyor...
          </div>
        )}
      </div>
    </div>
  );
}
