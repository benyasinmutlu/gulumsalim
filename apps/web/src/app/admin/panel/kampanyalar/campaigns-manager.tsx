"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminCampaign, AdminCategory, AdminProductRow, AdminVendorsResponse } from "@/lib/types";

type Scope = AdminCampaign["scope"];
type CampaignType = AdminCampaign["type"];

const TYPE_LABEL = { percent: "Yüzde İndirim", free_shipping: "Ücretsiz Kargo" } as const;
const SCOPE_LABEL = { all: "Tüm Site", category: "Kategori", vendor: "Mağaza", product: "Ürün" } as const;

function toIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export default function CampaignsManager() {
  const [campaigns, setCampaigns] = useState<AdminCampaign[] | null>(null);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [vendors, setVendors] = useState<AdminVendorsResponse["vendors"]>([]);
  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState<CampaignType>("percent");
  const [scope, setScope] = useState<Scope>("all");
  const [scopeId, setScopeId] = useState("");
  const [value, setValue] = useState("");
  const [minimum, setMinimum] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    setCampaigns(await fetchJson<AdminCampaign[]>("/admin/campaigns"));
  }, []);

  useEffect(() => {
    Promise.all([
      loadCampaigns(),
      fetchJson<AdminCategory[]>("/admin/categories").then(setCategories),
      fetchJson<AdminVendorsResponse>("/admin/vendors?status=active").then((result) => setVendors(result.vendors)),
    ]).catch((caught) => setError(caught instanceof ClientApiError ? caught.message : "Kampanya verileri yüklenemedi"));
  }, [loadCampaigns]);

  async function searchProducts() {
    if (productSearch.trim().length < 2) {
      setError("Ürün aramak için en az 2 karakter yazın");
      return;
    }
    setError(null);
    const result = await fetchJson<{ items: AdminProductRow[] }>(`/admin/products?status=active&search=${encodeURIComponent(productSearch.trim())}`);
    setProducts(result.items);
  }

  function resetTarget(nextScope: Scope) {
    setScope(nextScope);
    setScopeId("");
    setProducts([]);
    setProductSearch("");
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await mutateJson("/admin/campaigns", "POST", {
        name,
        type,
        scope,
        scopeId: scope === "all" ? undefined : Number(scopeId),
        value: type === "percent" ? Number(value) : 0,
        minOrderAmount: minimum ? Number(minimum) : undefined,
        startsAt: toIso(startsAt),
        endsAt: toIso(endsAt),
        isActive: true,
      });
      setName("");
      setValue("");
      setMinimum("");
      setStartsAt("");
      setEndsAt("");
      resetTarget("all");
      await loadCampaigns();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Kampanya oluşturulamadı");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(campaign: AdminCampaign) {
    setError(null);
    try {
      await mutateJson(`/admin/campaigns/${campaign.id}`, "PATCH", { isActive: !campaign.isActive });
      await loadCampaigns();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Kampanya güncellenemedi");
    }
  }

  async function remove(campaign: AdminCampaign) {
    if (!window.confirm(`“${campaign.name}” kampanyasını silmek istiyor musunuz?`)) return;
    setError(null);
    try {
      await mutateJson(`/admin/campaigns/${campaign.id}`, "DELETE", {});
      await loadCampaigns();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Kampanya silinemedi");
    }
  }

  return (
    <>
      <form className="admin-card" onSubmit={handleCreate}>
        <div className="admin-card-header"><h2>Yeni Kampanya</h2></div>
        <div className="admin-card-body admin-campaign-form">
          <div className="admin-form-group">
            <label htmlFor="campaign-name">Kampanya Adı</label>
            <input id="campaign-name" className="admin-form-control" required minLength={2} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="admin-form-group">
            <label htmlFor="campaign-type">Tür</label>
            <select id="campaign-type" className="admin-form-control" value={type} onChange={(event) => setType(event.target.value as CampaignType)}>
              <option value="percent">Yüzde İndirim</option>
              <option value="free_shipping">Ücretsiz Kargo</option>
            </select>
          </div>
          {type === "percent" && (
            <div className="admin-form-group">
              <label htmlFor="campaign-value">İndirim Oranı (%)</label>
              <input id="campaign-value" className="admin-form-control" type="number" required min={0.01} max={100} step="0.01" value={value} onChange={(event) => setValue(event.target.value)} />
            </div>
          )}
          <div className="admin-form-group">
            <label htmlFor="campaign-scope">Kapsam</label>
            <select id="campaign-scope" className="admin-form-control" value={scope} onChange={(event) => resetTarget(event.target.value as Scope)}>
              <option value="all">Tüm Site</option>
              <option value="category">Kategori</option>
              <option value="vendor">Mağaza</option>
              <option value="product">Ürün</option>
            </select>
          </div>
          {scope === "category" && (
            <div className="admin-form-group">
              <label htmlFor="campaign-category">Kategori</label>
              <select id="campaign-category" className="admin-form-control" required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                <option value="">Seçin</option>
                {categories.filter((category) => category.isActive).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
          )}
          {scope === "vendor" && (
            <div className="admin-form-group">
              <label htmlFor="campaign-vendor">Mağaza</label>
              <select id="campaign-vendor" className="admin-form-control" required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                <option value="">Seçin</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.storeName} ({vendor.vendorType === "business" ? "Kurumsal" : "Bireysel"})</option>)}
              </select>
            </div>
          )}
          {scope === "product" && (
            <div className="admin-form-group admin-product-target">
              <label htmlFor="campaign-product-search">Ürün</label>
              <div className="admin-inline-search">
                <input id="campaign-product-search" className="admin-form-control" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Ürün adıyla ara" />
                <button type="button" className="admin-btn" onClick={searchProducts}>Ara</button>
              </div>
              {products.length > 0 && (
                <select className="admin-form-control" required value={scopeId} onChange={(event) => setScopeId(event.target.value)}>
                  <option value="">Ürün seçin</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name} — {product.vendorStoreName}</option>)}
                </select>
              )}
            </div>
          )}
          <div className="admin-form-group">
            <label htmlFor="campaign-minimum">Minimum Sepet (TL)</label>
            <input id="campaign-minimum" className="admin-form-control" type="number" min={0.01} step="0.01" value={minimum} onChange={(event) => setMinimum(event.target.value)} placeholder="Opsiyonel" />
          </div>
          <div className="admin-form-group">
            <label htmlFor="campaign-start">Başlangıç</label>
            <input id="campaign-start" className="admin-form-control" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} />
          </div>
          <div className="admin-form-group">
            <label htmlFor="campaign-end">Bitiş</label>
            <input id="campaign-end" className="admin-form-control" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} />
          </div>
        </div>
        {error && <p className="error-text admin-campaign-error" role="alert">{error}</p>}
        <div className="admin-card-body admin-campaign-actions">
          <button className="admin-btn admin-btn-primary" disabled={busy || (scope !== "all" && !scopeId)}>{busy ? "Oluşturuluyor…" : "Kampanya Oluştur"}</button>
        </div>
      </form>

      <div className="admin-card">
        <div className="admin-card-header"><h2>Kampanyalar</h2></div>
        {campaigns === null ? <div className="admin-card-body">Yükleniyor…</div> : campaigns.length === 0 ? (
          <div className="admin-empty"><i className="fas fa-bullhorn" /><h3>Henüz kampanya yok</h3></div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Ad</th><th>Tür</th><th>Kapsam</th><th>Değer</th><th>Tarih</th><th>Durum</th><th>İşlem</th></tr></thead>
              <tbody>{campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td><strong>{campaign.name}</strong></td>
                  <td>{TYPE_LABEL[campaign.type]}</td>
                  <td>{SCOPE_LABEL[campaign.scope]}{campaign.scopeId ? ` #${campaign.scopeId}` : ""}</td>
                  <td>{campaign.type === "percent" ? `%${Number(campaign.value)}` : "Ücretsiz"}</td>
                  <td>{campaign.endsAt ? new Date(campaign.endsAt).toLocaleDateString("tr-TR") : "Süresiz"}</td>
                  <td><span className={`admin-badge ${campaign.isActive ? "admin-badge-active" : "admin-badge-draft"}`}>{campaign.isActive ? "Aktif" : "Pasif"}</span></td>
                  <td className="admin-row-actions">
                    <button className="admin-btn admin-btn-sm" onClick={() => toggle(campaign)}>{campaign.isActive ? "Pasifleştir" : "Aktifleştir"}</button>
                    <button className="admin-btn admin-btn-sm" onClick={() => remove(campaign)}>Sil</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
