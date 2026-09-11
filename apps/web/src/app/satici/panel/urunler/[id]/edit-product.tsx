"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { Category, ProductCondition, VendorProduct, VendorProductImage, VendorProductVariant } from "@/lib/types";
import { PRODUCT_CONDITIONS } from "@/lib/product-condition";
import { useIsIndividualVendor } from "../../vendor-type-context";

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

export default function EditProduct({
  productId,
  setupIncomplete = false,
  setupMissing,
}: {
  productId: number;
  setupIncomplete?: boolean;
  setupMissing?: string;
}) {
  // bkz. kullanıcı isteği: "bireysel satıcıları ... yerleri daha basit ve
  // kullanımı kolay olsun" - beden/renk/stok varyant yönetimi tek parça
  // satan bir bireysel satıcı için gereksiz karmaşıklık (bkz. sidebar-nav.tsx
  // aynı gerekçe). Varyant eklenmese de ürün zaten tek seçenek olarak
  // satılabiliyor, bu yüzden kartı tamamen kaldırmak veri kaybı yaratmıyor.
  const isIndividual = useIsIndividualVendor();
  const [product, setProduct] = useState<VendorProduct | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [images, setImages] = useState<VendorProductImage[]>([]);
  const [variants, setVariants] = useState<VendorProductVariant[]>([]);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [brand, setBrand] = useState("");
  // bkz. denetim raporu: "Marka yönetimi" - admin onaylı markalar datalist
  // önerisi olarak sunulur (bkz. new-product-form.tsx aynı desen).
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [newAttributeKey, setNewAttributeKey] = useState("");
  const [newAttributeValue, setNewAttributeValue] = useState("");
  const [status, setStatus] = useState<VendorProduct["status"]>("draft");
  const [freeShipping, setFreeShipping] = useState(false);
  const [isSecondHand, setIsSecondHand] = useState(false);
  // bkz. denetim raporu madde 1/2: önceden bu alan sadece ürün oluşturma
  // formunda vardı, düzenleme formunda hiç yoktu.
  const [condition, setCondition] = useState<ProductCondition | "">("");
  const [hasDefect, setHasDefect] = useState(false);
  const [defectDescription, setDefectDescription] = useState("");
  const [defectPhotoUrl, setDefectPhotoUrl] = useState<string | null>(null);
  const [defectPhotoUploading, setDefectPhotoUploading] = useState(false);
  const defectPhotoInputRef = useRef<HTMLInputElement>(null);
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli" - sadece varyantsız (renk/beden eklenmemiş)
  // kurumsal ürünlerde gösterilir, load() içinde totalStock'tan doldurulur
  // (varyantsız üründe totalStock === products.stock, bkz. backend
  // listVendorProducts).
  const [stock, setStock] = useState("0");
  // bkz. kargo/PTT denetim raporu Faz 1 (2026-09-10): ürünün fiziksel kargo
  // verisi - opsiyonel, HENÜZ hiçbir kargo ücreti hesabına bağlı değil,
  // sadece ileride PTT/taşıyıcı entegrasyonu için toplanıyor.
  const [weightGrams, setWeightGrams] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [videoUploading, setVideoUploading] = useState(false);

  const [variantSize, setVariantSize] = useState("");
  const [variantColor, setVariantColor] = useState("");
  const [variantStock, setVariantStock] = useState("0");
  const [variantPriceOverride, setVariantPriceOverride] = useState("");
  const [variantSaving, setVariantSaving] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  async function load() {
    const [productList, imageList, variantList, categoryList] = await Promise.all([
      fetchJson<VendorProduct[]>("/vendor/products"),
      fetchJson<VendorProductImage[]>(`/vendor/products/${productId}/images`),
      fetchJson<VendorProductVariant[]>(`/vendor/products/${productId}/variants`),
      fetchJson<Category[]>("/categories"),
    ]);
    const found = productList.find((p) => p.id === productId) ?? null;
    setProduct(found);
    if (found) {
      setName(found.name);
      setCategoryId(found.categoryId);
      setBasePrice(found.basePrice);
      setCompareAtPrice(found.compareAtPrice ?? "");
      setBrand(found.brand ?? "");
      setDescription(found.description ?? "");
      setAttributes(found.attributes ?? {});
      setStatus(found.status);
      setFreeShipping(found.freeShipping);
      setIsSecondHand(found.isSecondHand ?? false);
      setCondition(found.condition ?? "");
      setHasDefect(found.hasDefect ?? false);
      setDefectDescription(found.defectDescription ?? "");
      setDefectPhotoUrl(found.defectPhotoUrl ?? null);
      setStock(String(found.totalStock));
      setWeightGrams(found.weightGrams != null ? String(found.weightGrams) : "");
      setWidthCm(found.widthCm ?? "");
      setHeightCm(found.heightCm ?? "");
      setLengthCm(found.lengthCm ?? "");
    }
    setImages(imageList);
    setVariants(variantList);
    setCategories(categoryList);
  }

  useEffect(() => {
    fetchJson<string[]>("/brands").then(setBrandSuggestions).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // load yalnızca productId değiştiğinde yeniden çalışmalıdır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  async function handleSave() {
    if (!condition) {
      setMessage("Lütfen ürün durumunu seçin");
      return;
    }
    if (hasDefect && defectDescription.trim().length < 5) {
      setMessage("Kusuru en az birkaç kelimeyle açıklayın");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await mutateJson(`/vendor/products/${productId}`, "PATCH", {
        name,
        categoryId: categoryId || undefined,
        basePrice: Number(basePrice),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
        brand: brand || undefined,
        description: description || undefined,
        attributes,
        condition,
        hasDefect,
        defectDescription: hasDefect ? defectDescription : undefined,
        // bkz. olay: 2026-08-02 - bireysel satıcı durumu bu formdan
        // değiştiremez (bkz. handleSubmitForApproval), göndermeden atlanır.
        ...(isIndividual ? {} : { status }),
        freeShipping,
        isSecondHand: isIndividual ? isSecondHand : false,
        ...(!isIndividual && variants.length === 0 ? { stock: Number(stock) } : {}),
        weightGrams: weightGrams !== "" ? Number(weightGrams) : undefined,
        widthCm: widthCm !== "" ? Number(widthCm) : undefined,
        heightCm: heightCm !== "" ? Number(heightCm) : undefined,
        lengthCm: lengthCm !== "" ? Number(lengthCm) : undefined,
      });
      setMessage("Kaydedildi.");
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  // bkz. denetim raporu madde 2: kusur fotoğrafı - genel görsel yükleme
  // ucuna isDefectPhoto=true sorgu parametresiyle gönderilir (bkz.
  // vendor-products.routes.ts), aynı desende new-product-form.tsx.
  async function handleDefectPhotoSelected() {
    const file = defectPhotoInputRef.current?.files?.[0];
    if (!file) return;
    setDefectPhotoUploading(true);
    setMessage(null);
    try {
      await uploadFile(`/vendor/products/${productId}/images?isDefectPhoto=true`, file);
      await load();
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Kusur fotoğrafı yüklenemedi");
    } finally {
      setDefectPhotoUploading(false);
      if (defectPhotoInputRef.current) defectPhotoInputRef.current.value = "";
    }
  }

  // bkz. kullanıcı isteği: "bireysel satıcıların ürünleri yayınlanması için
  // onaylanması gerekiyor adminden" - taslak/pasif/reddedilmiş bir ürünü
  // "onay bekliyor"a taşır; admin onaylayana kadar sitede görünmez (bkz.
  // vendor-products.routes.ts PATCH).
  async function handleSubmitForApproval() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await mutateJson<VendorProduct>(`/vendor/products/${productId}`, "PATCH", { status: "pending" });
      setStatus(updated.status);
      setMessage("Onaya gönderildi.");
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Gönderilemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleFileSelected() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setMessage(null);
    try {
      await uploadFile(`/vendor/products/${productId}/images`, file);
      await load();
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeleteImage(imageId: number) {
    await mutateJson(`/vendor/products/${productId}/images/${imageId}`, "DELETE");
    await load();
  }

  async function handleSetPrimaryImage(imageId: number) {
    await mutateJson(`/vendor/products/${productId}/images/${imageId}/primary`, "POST");
    await load();
  }

  async function handleVideoSelected() {
    const file = videoInputRef.current?.files?.[0];
    if (!file) return;
    setVideoUploading(true);
    setMessage(null);
    try {
      const updated = await uploadFile<VendorProduct>(`/vendor/products/${productId}/video`, file);
      setProduct(updated);
    } catch (err) {
      setMessage(err instanceof ClientApiError ? err.message : "Video yüklenemedi");
    } finally {
      setVideoUploading(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  async function handleDeleteVideo() {
    if (!confirm("Video silinsin mi?")) return;
    await mutateJson(`/vendor/products/${productId}/video`, "DELETE");
    setProduct((p) => (p ? { ...p, videoUrl: null } : p));
  }

  async function handleAddVariant(e: FormEvent) {
    e.preventDefault();
    setVariantSaving(true);
    setVariantError(null);
    try {
      await mutateJson(`/vendor/products/${productId}/variants`, "POST", {
        size: variantSize || undefined,
        color: variantColor || undefined,
        stock: Number(variantStock),
        priceOverride: variantPriceOverride ? Number(variantPriceOverride) : undefined,
      });
      setVariantSize("");
      setVariantColor("");
      setVariantStock("0");
      setVariantPriceOverride("");
      await load();
    } catch (err) {
      setVariantError(err instanceof ClientApiError ? err.message : "Varyant eklenemedi");
    } finally {
      setVariantSaving(false);
    }
  }

  async function handleDeleteVariant(variantId: number) {
    await mutateJson(`/vendor/products/${productId}/variants/${variantId}`, "DELETE");
    await load();
  }

  async function handleVariantStockChange(variantId: number, stock: number) {
    await mutateJson(`/vendor/products/${productId}/variants/${variantId}`, "PATCH", { stock });
    await load();
  }

  if (product === null) return <div className="card"><div className="card-body">Yükleniyor...</div></div>;

  return (
    <div>
      {setupIncomplete && (
        <div className="alert alert-wa" role="alert">
          <i className="fas fa-triangle-exclamation" />
          <span>
            Ürün güvenli biçimde taslakta tutuldu. Yüklenemeyen bölüm: {setupMissing || "ürün kurulumu"}.
            Eksikleri tamamladıktan sonra yeniden onaya gönderin.
          </span>
        </div>
      )}
      <div className="card">
        <div className="ch">
          <h3>Ürün Bilgileri</h3>
        </div>
        <div className="fc" style={{ padding: "20px" }}>
          <div className="fg">
            <label>Ürün Adı</label>
            <input className="fi" maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fg">
            <label>Kategori</label>
            <select className="fi" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Marka</label>
            <input className="fi" list="brand-suggestions" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
            <datalist id="brand-suggestions">
              {brandSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </div>
          <div className="fg">
            <label>Ürün Durumu</label>
            <select className="fi" required value={condition} onChange={(e) => setCondition(e.target.value as ProductCondition)}>
              <option value="">Seçin...</option>
              {PRODUCT_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={hasDefect} onChange={(e) => setHasDefect(e.target.checked)} />
              Üründe kusur/deformasyon var
            </label>
            {hasDefect && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  className="fi"
                  rows={2}
                  value={defectDescription}
                  onChange={(e) => setDefectDescription(e.target.value)}
                  placeholder="Kusuru açıkça tarif edin (ör. sol kolda küçük leke)"
                />
                {defectPhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={defectPhotoUrl} alt="" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: "1px solid var(--br)" }} />
                ) : (
                  <p style={{ fontSize: "0.8rem", color: "var(--er)" }}>
                    Kusur fotoğrafı henüz yüklenmedi - yüklemeden ürün onaya/aktife gönderilemez.
                  </p>
                )}
                <input
                  ref={defectPhotoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleDefectPhotoSelected}
                  disabled={defectPhotoUploading}
                />
                {defectPhotoUploading && <small>Yükleniyor...</small>}
              </div>
            )}
          </div>
          <div className="row2">
            <div className="fg">
              <label>Fiyat (₺)</label>
              <input className="fi" type="number" min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
            <div className="fg">
              <label>İndirimli Fiyat (₺)</label>
              <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
            </div>
          </div>
          {isIndividual ? (
            <div className="fg">
              <label>Durum</label>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`st st-${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                {(status === "draft" || status === "inactive" || status === "rejected") && (
                  <button type="button" className="btn btn-pr btn-sm" onClick={handleSubmitForApproval} disabled={saving}>
                    <i className="fas fa-paper-plane" /> Onaya Gönder
                  </button>
                )}
              </div>
              {status === "pending" && (
                <p style={{ fontSize: "0.8rem", color: "var(--tx3)", marginTop: 6 }}>
                  Ürününüz admin onayını bekliyor, onaylanınca sitede görünecek.
                </p>
              )}
              {status === "rejected" && (
                <p style={{ fontSize: "0.8rem", color: "var(--er)", marginTop: 6 }}>
                  Ürününüz reddedildi. Bilgileri güncelleyip tekrar onaya gönderebilirsiniz.
                </p>
              )}
            </div>
          ) : (
            <div className="fg">
              <label>Durum</label>
              <select className="fi" value={status} onChange={(e) => setStatus(e.target.value as VendorProduct["status"])} disabled={status === "rejected"}>
                {status === "rejected" && <option value="rejected">Reddedildi (admin tarafından)</option>}
                <option value="draft">Taslak</option>
                <option value="active">Aktif</option>
                <option value="inactive">Pasif</option>
              </select>
            </div>
          )}
          {!isIndividual && variants.length === 0 && (
            <div className="fg">
              <label>Stok Adedi</label>
              <input className="fi" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} />
              <small style={{ color: "var(--tx3)" }}>
                Beden/renk varyantı eklemediğiniz için ürün bu stok adediyle tek seçenek olarak satılır. Ürünü aktife çekmeden önce stok girmeniz zorunludur.
              </small>
            </div>
          )}
          <div className="fg">
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={freeShipping} onChange={(e) => setFreeShipping(e.target.checked)} />
              Bu ürün için kargo her zaman ücretsiz
            </label>
          </div>
          {/* bkz. kullanıcı isteği: "normal kurumsal satıcılar için 2.el
              seçeneği olmasın" - sadece bireysel satıcılarda görünür. */}
          {isIndividual && (
            <div className="fg">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={isSecondHand} onChange={(e) => setIsSecondHand(e.target.checked)} />
                Bu ürün 2. el
              </label>
            </div>
          )}
          <div className="fg">
            <label>Açıklama</label>
            <textarea className="fi" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ürününüzü müşterilere anlatın: kumaş, kalıp, bakım önerileri..." />
          </div>
          <div className="fg">
            <label>Ürün Özellikleri</label>
            {Object.entries(attributes).map(([key, value]) => (
              <div key={key} className="row2" style={{ alignItems: "center", marginBottom: 8 }}>
                <input className="fi" value={key} disabled />
                <input className="fi" value={value} onChange={(event) => setAttributes((previous) => ({ ...previous, [key]: event.target.value }))} />
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setAttributes((previous) => Object.fromEntries(Object.entries(previous).filter(([existing]) => existing !== key)))}>Sil</button>
              </div>
            ))}
            <div className="row2" style={{ alignItems: "center" }}>
              <input className="fi" value={newAttributeKey} onChange={(event) => setNewAttributeKey(event.target.value)} placeholder="Özellik (ör. Materyal)" />
              <input className="fi" value={newAttributeValue} onChange={(event) => setNewAttributeValue(event.target.value)} placeholder="Değer" />
              <button
                type="button"
                className="btn btn-sec btn-sm"
                disabled={!newAttributeKey.trim() || !newAttributeValue.trim() || Object.keys(attributes).length >= 20}
                onClick={() => {
                  setAttributes((previous) => ({ ...previous, [newAttributeKey.trim()]: newAttributeValue.trim() }));
                  setNewAttributeKey("");
                  setNewAttributeValue("");
                }}
              >
                Ekle
              </button>
            </div>
            <small style={{ color: "var(--tx3)" }}>Müşteriler bu bilgileri ürün sayfasında tablo halinde görür.</small>
          </div>
          {message && <p style={{ fontSize: "0.85rem" }}>{message}</p>}
          <button className="btn btn-pr" onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Kargo Bilgileri</h3>
        </div>
        <div className="fc" style={{ padding: "20px" }}>
          <p style={{ fontSize: "0.8rem", color: "var(--tx3)", margin: 0 }}>
            Opsiyonel. Kargo hesaplamasında henüz kullanılmıyor, ileride taşıyıcı entegrasyonu için toplanıyor.
          </p>
          <div className="row2">
            <div className="fg">
              <label>Ağırlık (gram)</label>
              <input className="fi" type="number" min={0} max={50000} value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} placeholder="ör. 750" />
            </div>
            <div className="fg">
              <label>En (cm)</label>
              <input className="fi" type="number" min={0} max={500} step="0.1" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="ör. 20" />
            </div>
          </div>
          <div className="row2">
            <div className="fg">
              <label>Boy (cm)</label>
              <input className="fi" type="number" min={0} max={500} step="0.1" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="ör. 30" />
            </div>
            <div className="fg">
              <label>Yükseklik (cm)</label>
              <input className="fi" type="number" min={0} max={500} step="0.1" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} placeholder="ör. 5" />
            </div>
          </div>
          <div>
            <button className="btn btn-pr" onClick={handleSave} disabled={saving} style={{ alignSelf: "flex-start" }}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Görseller</h3>
        </div>
        <div className="card-body">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1rem" }}>
            {images.map((img) => (
              <div key={img.id} style={{ position: "relative" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt=""
                  width={110}
                  height={110}
                  className="img-preview"
                  style={{ width: 110, height: 110, outline: img.isPrimary ? "3px solid var(--pr)" : "none", outlineOffset: 2 }}
                />
                {img.isPrimary ? (
                  <span style={{ display: "block", textAlign: "center", fontSize: "0.7rem", color: "var(--pr)", fontWeight: 700, marginTop: "0.3rem" }}>
                    <i className="fas fa-star" /> Vitrin Görseli
                  </span>
                ) : (
                  <button
                    className="btn btn-sec btn-sm"
                    style={{ marginTop: "0.3rem", width: "100%" }}
                    onClick={() => handleSetPrimaryImage(img.id)}
                  >
                    Vitrin Görseli Yap
                  </button>
                )}
                <button className="btn btn-danger btn-sm" style={{ marginTop: "0.3rem", width: "100%" }} onClick={() => handleDeleteImage(img.id)}>
                  Sil
                </button>
              </div>
            ))}
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileSelected} disabled={uploading} />
          {uploading && <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>Yükleniyor...</p>}
        </div>
      </div>

      <div className="card">
        <div className="ch">
          <h3>Ürün Videosu</h3>
        </div>
        <div className="card-body">
          {product.videoUrl ? (
            <div style={{ marginBottom: "1rem" }}>
              <video
                src={product.videoUrl}
                controls
                playsInline
                preload="metadata"
                style={{ width: "100%", maxWidth: 360, borderRadius: 12, background: "#000", display: "block" }}
              />
              <button className="btn btn-danger btn-sm" style={{ marginTop: "0.5rem" }} onClick={handleDeleteVideo}>
                <i className="fas fa-trash" /> Videoyu Kaldır
              </button>
            </div>
          ) : (
            <p style={{ fontSize: "0.85rem", color: "var(--tx3)", marginBottom: "0.75rem" }}>
              Ürününüz için kısa bir tanıtım videosu ekleyebilirsiniz — ürün sayfasında müşterilere oynatılır (MP4, WebM, MOV · en fazla 50MB).
            </p>
          )}
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={handleVideoSelected}
            disabled={videoUploading}
          />
          {videoUploading && (
            <p style={{ fontSize: "0.85rem", marginTop: "0.4rem" }}>Video yükleniyor... (büyük dosya biraz sürebilir)</p>
          )}
        </div>
      </div>

      {!isIndividual && (
      <div className="card">
        <div className="ch">
          <h3>Beden / Renk Varyantları</h3>
        </div>
        {variants.length === 0 ? (
          <div className="empty">
            <i className="fas fa-ruler" />
            <p>Henüz varyant eklenmedi. Varyant eklenmezse müşteri ürünü tek bir seçenek olarak satın alır.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Beden</th>
                  <th>Renk</th>
                  <th>Fiyat Farkı (₺)</th>
                  <th>Stok</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.id}>
                    <td>{v.sku}</td>
                    <td>{v.size ?? "—"}</td>
                    <td>{v.color ?? "—"}</td>
                    <td>{v.priceOverride ?? "—"}</td>
                    <td>
                      <input
                        className="fi"
                        type="number"
                        min={0}
                        defaultValue={v.stock}
                        style={{ width: "80px" }}
                        onBlur={(e) => handleVariantStockChange(v.id, Number(e.target.value))}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteVariant(v.id)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p style={{ padding: "16px 20px 0", fontSize: "0.8rem", color: "var(--tx3)" }}>
          <i className="fas fa-info-circle" /> SKU kodu sistem tarafından otomatik oluşturulur.
        </p>
        <form className="row4" style={{ padding: "16px 20px", alignItems: "flex-end" }} onSubmit={handleAddVariant}>
          <div className="fg">
            <label>Beden</label>
            <input className="fi" value={variantSize} onChange={(e) => setVariantSize(e.target.value)} placeholder="S, M, L..." />
          </div>
          <div className="fg">
            <label>Renk</label>
            <input className="fi" value={variantColor} onChange={(e) => setVariantColor(e.target.value)} />
          </div>
          <div className="fg">
            <label>Stok</label>
            <input className="fi" type="number" min={0} value={variantStock} onChange={(e) => setVariantStock(e.target.value)} />
          </div>
          <div className="fg">
            <label>Fiyat Farkı (₺)</label>
            <input className="fi" type="number" step="0.01" value={variantPriceOverride} onChange={(e) => setVariantPriceOverride(e.target.value)} placeholder="Opsiyonel" />
          </div>
          <button className="btn btn-pr" type="submit" disabled={variantSaving}>
            {variantSaving ? "Ekleniyor..." : "Varyant Ekle"}
          </button>
        </form>
        {variantError && <p style={{ color: "var(--er)", fontSize: "0.85rem", padding: "0 20px 16px" }}>{variantError}</p>}
      </div>
      )}
    </div>
  );
}
