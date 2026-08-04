"use client";

import { useEffect, useState } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminCoupon } from "@/lib/types";

interface FormState {
  code: string;
  type: "percent" | "fixed";
  value: string;
  minOrderAmount: string;
  maxUsesTotal: string;
  maxUsesPerCustomer: string;
  endsAt: string;
  isFeatured: boolean;
}

const EMPTY_FORM: FormState = {
  code: "",
  type: "fixed",
  value: "",
  minOrderAmount: "",
  maxUsesTotal: "",
  maxUsesPerCustomer: "1",
  endsAt: "",
  isFeatured: false,
};

function toIso(datetimeLocal: string): string | undefined {
  if (!datetimeLocal) return undefined;
  return new Date(datetimeLocal).toISOString();
}

// bkz. kullanıcı isteği: "kupon kodu... admin panelde kontrol edebilelim" -
// oluştur/pasifleştir/öne çıkar. Hard delete yok (bkz. admin-coupons.routes.ts
// yorumu) - kullanılmış bir kupon kaydı korunur, sadece isActive:false ile
// pasifleştirilir.
export default function CouponsManager() {
  const [coupons, setCoupons] = useState<AdminCoupon[] | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setCoupons(await fetchJson<AdminCoupon[]>("/admin/coupons"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    if (!form.code.trim() || !form.value.trim()) {
      setError("Kupon kodu ve değer zorunlu");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await mutateJson("/admin/coupons", "POST", {
        code: form.code.trim(),
        type: form.type,
        value: Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : undefined,
        maxUsesTotal: form.maxUsesTotal ? Number(form.maxUsesTotal) : undefined,
        maxUsesPerCustomer: Number(form.maxUsesPerCustomer) || 1,
        endsAt: toIso(form.endsAt),
        isActive: true,
        isFeatured: form.isFeatured,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kupon oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(coupon: AdminCoupon) {
    await mutateJson(`/admin/coupons/${coupon.id}`, "PATCH", { isActive: !coupon.isActive });
    await load();
  }

  async function toggleFeatured(coupon: AdminCoupon) {
    await mutateJson(`/admin/coupons/${coupon.id}`, "PATCH", { isFeatured: !coupon.isFeatured });
    await load();
  }

  return (
    <>
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Yeni Kupon</h2>
        </div>
        <div className="admin-card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.8rem" }}>
          <div className="admin-form-group">
            <label>Kupon Kodu</label>
            <input
              className="admin-form-control"
              placeholder="GULUM100"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="admin-form-group">
            <label>Tür</label>
            <select className="admin-form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "percent" | "fixed" })}>
              <option value="fixed">Sabit Tutar (TL)</option>
              <option value="percent">Yüzde (%)</option>
            </select>
          </div>
          <div className="admin-form-group">
            <label>Değer</label>
            <input
              className="admin-form-control"
              type="number"
              placeholder={form.type === "percent" ? "10" : "100"}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
          </div>
          <div className="admin-form-group">
            <label>Min. Sepet Tutarı (TL, opsiyonel)</label>
            <input
              className="admin-form-control"
              type="number"
              value={form.minOrderAmount}
              onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
            />
          </div>
          <div className="admin-form-group">
            <label>Toplam Kullanım Limiti (opsiyonel)</label>
            <input
              className="admin-form-control"
              type="number"
              value={form.maxUsesTotal}
              onChange={(e) => setForm({ ...form, maxUsesTotal: e.target.value })}
            />
          </div>
          <div className="admin-form-group">
            <label>Müşteri Başına Kullanım</label>
            <input
              className="admin-form-control"
              type="number"
              value={form.maxUsesPerCustomer}
              onChange={(e) => setForm({ ...form, maxUsesPerCustomer: e.target.value })}
            />
          </div>
          <div className="admin-form-group">
            <label>Bitiş Tarihi (opsiyonel)</label>
            <input
              className="admin-form-control"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
          <div className="admin-form-group" style={{ justifyContent: "flex-end" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              Anasayfada öne çıkar
            </label>
          </div>
        </div>
        {error && (
          <p className="error-text" style={{ color: "var(--admin-error)", padding: "0 1rem" }}>
            {error}
          </p>
        )}
        <div className="admin-card-body" style={{ paddingTop: 0 }}>
          <button className="admin-btn admin-btn-primary" onClick={handleCreate} disabled={creating}>
            {creating ? "Oluşturuluyor..." : "Kupon Oluştur"}
          </button>
        </div>
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Kuponlar</h2>
        </div>
        {coupons === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : coupons.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-ticket-alt" />
            <h3>Henüz kupon yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>İndirim</th>
                  <th>Min. Sepet</th>
                  <th>Kullanım</th>
                  <th>Bitiş</th>
                  <th>Durum</th>
                  <th>Öne Çıkan</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>{c.code}</td>
                    <td>{c.type === "percent" ? `%${Number(c.value)}` : `${Number(c.value).toFixed(2)} TL`}</td>
                    <td>{c.minOrderAmount ? `${Number(c.minOrderAmount).toFixed(2)} TL` : "—"}</td>
                    <td>
                      {c.usedCount}
                      {c.maxUsesTotal ? ` / ${c.maxUsesTotal}` : ""}
                    </td>
                    <td>{c.endsAt ? new Date(c.endsAt).toLocaleDateString("tr-TR") : "—"}</td>
                    <td>
                      <span className={`admin-badge ${c.isActive ? "admin-badge-active" : "admin-badge-draft"}`}>
                        {c.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td>{c.isFeatured ? <i className="fas fa-star" style={{ color: "#f5a623" }} /> : "—"}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="admin-btn admin-btn-sm" onClick={() => toggleActive(c)}>
                        {c.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                      <button className="admin-btn admin-btn-sm" onClick={() => toggleFeatured(c)}>
                        {c.isFeatured ? "Öne Çıkarmayı Kaldır" : "Öne Çıkar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
