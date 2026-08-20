"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { VendorProduct } from "@/lib/types";
import { useIsIndividualVendor } from "../vendor-type-context";

const STATUS_LABEL: Record<VendorProduct["status"], string> = {
  draft: "Taslak",
  pending: "Onay Bekliyor",
  active: "Aktif",
  inactive: "Pasif",
  rejected: "Reddedildi",
};

const STATUS_CLASS: Record<VendorProduct["status"], string> = {
  draft: "muted",
  pending: "warn",
  active: "success",
  inactive: "warn",
  rejected: "danger",
};

export default function ProductsTable() {
  const [products, setProducts] = useState<VendorProduct[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // bkz. olay: 2026-08-02 "ürün sil diyorum silmiyor" - setStatus/
  // removeProduct hataları hiç yakalamıyordu, istek 500/409 dönünce buton
  // sessizce "meşgul" durumdan çıkıyor ama kullanıcıya hiçbir şey
  // gösterilmiyordu (ürün de listede kalmaya devam ediyordu). Artık her
  // ikisi de hata mesajını yakalayıp gösteriyor.
  const [error, setError] = useState<string | null>(null);
  // bkz. kullanıcı isteği: "bireysel satıcının paneli ... çok daha
  // kullanışlı olmalı arayüzü basit olmalı dolap gibi" - yoğun, yatay
  // kaydırmalı tablo yerine görsel öncelikli kart ızgarası.
  const isIndividual = useIsIndividualVendor();

  async function load() {
    const data = await fetchJson<VendorProduct[]>("/vendor/products");
    setProducts(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(product: VendorProduct, status: string) {
    setBusyId(product.id);
    setError(null);
    try {
      await mutateJson(`/vendor/products/${product.id}`, "PATCH", { status });
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Durum güncellenemedi, tekrar deneyin.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeProduct(product: VendorProduct) {
    if (!confirm(`"${product.name}" silinsin mi?`)) return;
    setBusyId(product.id);
    setError(null);
    try {
      await mutateJson(`/vendor/products/${product.id}`, "DELETE");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ürün silinemedi, tekrar deneyin.");
    } finally {
      setBusyId(null);
    }
  }

  // bkz. olay: 2026-08-02 "bireysel satıcıların ürünleri yayınlanması için
  // onaylanması gerekiyor adminden" - bireysel satıcı taslak/reddedilmiş bir
  // ürünü artık doğrudan "aktif" yapamıyor (API 403 döner), bunun yerine
  // admin onayına gönderiyor ("pending"). Onay bekleyen bir ürün için hiç
  // aksiyon yok - sadece admin karar verebilir. "inactive"ten "active"e
  // dönmek istisna (bkz. vendor-products.routes.ts PATCH yorumu) - satıcı
  // kendi durdurduğu, zaten bir kez onaylanmış bir ürünü tekrar onaysız
  // açabilir.
  function getStatusAction(p: VendorProduct): { label: string; icon: string; onClick: () => void } | null {
    if (p.status === "pending") return null;
    if (p.status === "draft" || p.status === "rejected") {
      return isIndividual
        ? { label: "Onaya Gönder", icon: "fa-paper-plane", onClick: () => setStatus(p, "pending") }
        : { label: "Aktif Et", icon: "fa-eye", onClick: () => setStatus(p, "active") };
    }
    return p.status === "active"
      ? { label: "Pasife Al", icon: "fa-eye-slash", onClick: () => setStatus(p, "inactive") }
      : { label: "Aktif Et", icon: "fa-eye", onClick: () => setStatus(p, "active") };
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Ürünlerim</h3>
        <Link href="/satici/panel/urunler/yeni" className="btn btn-pr btn-sm">
          <i className="fas fa-plus" /> Yeni Ürün Ekle
        </Link>
      </div>
      {error && (
        <div className="alert alert-er" style={{ margin: "0 1rem" }}>
          <i className="fas fa-circle-exclamation" /> {error}
        </div>
      )}

      {products === null ? (
        <div className="card-body">Yükleniyor...</div>
      ) : products.length === 0 ? (
        <div className="empty">
          <i className="fas fa-tshirt" />
          <p>Henüz ürün eklemediniz.</p>
        </div>
      ) : isIndividual ? (
        <div className="vendor-product-grid">
          {products.map((p) => {
            const action = getStatusAction(p);
            return (
              <div key={p.id} className="vpc">
                <Link href={`/satici/panel/urunler/${p.id}`} className="vpc-img">
                  {p.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.primaryImageUrl} alt={p.name} />
                  ) : (
                    <i className="fas fa-image" />
                  )}
                  <span className={`st st-${STATUS_CLASS[p.status]} vpc-status`}>{STATUS_LABEL[p.status]}</span>
                </Link>
                <div className="vpc-body">
                  <Link href={`/satici/panel/urunler/${p.id}`} className="vpc-name">
                    {p.name}
                  </Link>
                  <div className="vpc-price">{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</div>
                  {p.totalStock === 0 && <div className="vpc-stock st st-danger">Tükendi</div>}
                  <div className="vpc-actions">
                    <Link href={`/satici/panel/urunler/${p.id}`} className="btn btn-sec btn-sm">
                      Düzenle
                    </Link>
                    {action && (
                      <button className="btn-icon" disabled={busyId === p.id} onClick={action.onClick} title={action.label}>
                        <i className={`fas ${action.icon}`} />
                      </button>
                    )}
                    <button className="btn-icon danger" disabled={busyId === p.id} onClick={() => removeProduct(p)} title="Sil">
                      <i className="fas fa-trash" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Ürün</th>
                <th>Fiyat</th>
                <th>Stok</th>
                <th>Durum</th>
                <th>İlgi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const action = getStatusAction(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/satici/panel/urunler/${p.id}`}>
                        {p.primaryImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.primaryImageUrl}
                            alt={p.name}
                            style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 6, display: "block" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 6,
                              background: "var(--bg2, #f3f3f3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "var(--tx3)",
                            }}
                          >
                            <i className="fas fa-image" />
                          </div>
                        )}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/satici/panel/urunler/${p.id}`}>{p.name}</Link>
                    </td>
                    <td>{Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺</td>
                    <td>
                      {p.totalStock === 0 ? (
                        <span className="st st-danger">Tükendi</span>
                      ) : p.totalStock <= 5 ? (
                        <span className="st st-warn">{p.totalStock} adet</span>
                      ) : (
                        <span>{p.totalStock} adet</span>
                      )}
                    </td>
                    <td>
                      <span className={`st st-${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                    </td>
                    <td>
                      {/* bkz. kullanıcı isteği: "ürünlerine kaç kişi baktı ...
                          favorideyse de göster ... sepetteyse göster" */}
                      <div style={{ display: "flex", gap: 10, fontSize: 12, color: "var(--tx3)" }}>
                        <span title="Görüntülenme"><i className="fas fa-eye" /> {p.viewCount}</span>
                        <span title="Favori"><i className="fas fa-heart" /> {p.favoriteCount}</span>
                        <span title="Sepette"><i className="fas fa-cart-shopping" /> {p.cartCount}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <Link href={`/satici/panel/urunler/${p.id}`} className="btn btn-sec btn-sm">
                          Düzenle
                        </Link>
                        {action && (
                          <button className="btn btn-sec btn-sm" disabled={busyId === p.id} onClick={action.onClick}>
                            {action.label}
                          </button>
                        )}
                        <button className="btn btn-danger btn-sm" disabled={busyId === p.id} onClick={() => removeProduct(p)}>
                          Sil
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
