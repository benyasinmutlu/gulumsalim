"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { Category, VendorProduct } from "@/lib/types";
import { useIsIndividualVendor } from "../../vendor-type-context";

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface StagedImage {
  file: File;
  url: string;
}

interface ColorStockRow {
  key: number;
  color: string;
  size: string;
  stock: string;
}

const WIZARD_STEPS = ["Fotoğraflar", "Bilgiler", "Fiyat", "Yayınla"];

export default function NewProductForm() {
  const router = useRouter();
  // bkz. kullanıcı isteği: "bireysel satıcılar ürün yüklerken hem mobilde
  // hem de desktopda step step ilerlesin en son yayınla diyene kadar" -
  // işletme satıcılarında tek sayfalık form aynen kalıyor, sadece bireysel
  // satıcıda adım adım sihirbaz gösteriliyor (aynı state/handler'lar,
  // sadece render farklı).
  const isIndividual = useIsIndividualVendor();
  const [step, setStep] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [brand, setBrand] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [isSecondHand, setIsSecondHand] = useState(false);
  // bkz. kullanıcı isteği: "satıcılar ürünleri yüklerken o ürünün
  // renklerinden kaç tane olduğunu girebilsinler toplam bu ürünün stok ne
  // kadar gibi şeyler olsun" - sadece kurumsal satıcı akışında (bireysel
  // satıcı tekil ürün/2.el modelinde varyant kullanmıyor, bkz. edit-product.tsx
  // aynı gerekçe).
  const [colorRows, setColorRows] = useState<ColorStockRow[]>([]);
  const colorRowKey = useRef(0);
  // bkz. kullanıcı isteği (2026-08-03): "kurumsal satıcıların stokları
  // zorunlu olarak girilmeli" - renk/beden satırı eklenmezse ürün artık
  // stok takibi olmadan DEĞİL, bu düz alandaki miktarla satılır (zorunlu).
  const [plainStock, setPlainStock] = useState("");
  const [images, setImages] = useState<StagedImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Kategoriler yalnızca admin tarafından yönetilir - satıcı yeni kategori
  // OLUŞTURAMAZ (aksi halde her mağaza keyfine göre kategori açardı). Sadece
  // mevcut kategorilerden seçilir.
  useEffect(() => {
    fetchJson<Category[]>("/categories").then(setCategories);
  }, []);

  // Seçilen görseller yüklenmeden önce önizlenir; ürün oluşturulunca hepsi
  // sırayla /vendor/products/{id}/images'a gönderilir. İlk görsel vitrin olur.
  function handleAddImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...next]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function addColorRow() {
    colorRowKey.current += 1;
    setColorRows((prev) => [...prev, { key: colorRowKey.current, color: "", size: "", stock: "0" }]);
  }

  function updateColorRow(key: number, field: "color" | "size" | "stock", value: string) {
    setColorRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function removeColorRow(key: number) {
    setColorRows((prev) => prev.filter((r) => r.key !== key));
  }

  const totalStock = colorRows.reduce((sum, r) => sum + (Number(r.stock) || 0), 0);

  // Ürün-zeka "✨ Otomatik doldur": mevcut ad/marka/kategori/bedeni enrich
  // endpoint'ine gönderip boş alanları (açıklama, kategori) öneriyle doldurur.
  // AI kapalıyken rule katmanı önerir. Hiçbir şey kaydetmez, satıcı düzenler.
  async function handleEnrich() {
    if (name.trim().length < 1) return;
    setEnriching(true);
    setError(null);
    try {
      const sizes = colorRows
        .map((r) => r.size)
        .filter(Boolean)
        .join(",");
      const categoryName = categories.find((c) => c.id === categoryId)?.name;
      const res = await mutateJson<{ suggestions: { categoryId: number | null; description: string | null; attributes: Record<string, string> } }>(
        "/vendor/products/enrich",
        "POST",
        { name, description: description || undefined, brand: brand || undefined, category: categoryName || undefined, sizes: sizes || undefined },
      );
      if (!description && res.suggestions.description) setDescription(res.suggestions.description);
      if (categoryId === "" && res.suggestions.categoryId) setCategoryId(res.suggestions.categoryId);
    } catch {
      setError("Otomatik doldurma şu an çalışmadı, elle devam edebilirsiniz.");
    } finally {
      setEnriching(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Sihirbazda ara adımlarda Enter'a basılırsa formu erken göndermesin -
    // sadece son adımda ("Yayınla") gerçekten gönderilir.
    if (isIndividual && step !== WIZARD_STEPS.length - 1) return;
    if (!categoryId) {
      setError("Lütfen bir kategori seçin");
      return;
    }
    if (!isIndividual && colorRows.length === 0 && (!plainStock || Number(plainStock) <= 0)) {
      setError("Lütfen stok adedi girin veya en az bir renk/stok satırı ekleyin.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const product = await mutateJson<VendorProduct>("/vendor/products", "POST", {
        categoryId,
        name,
        slug,
        description: description || undefined,
        brand: brand || undefined,
        basePrice: Number(basePrice),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
        isSecondHand: isIndividual ? isSecondHand : false,
        stock: !isIndividual && colorRows.length === 0 ? Number(plainStock) : undefined,
      });

      // Renk/stok satırları girildiyse, ürün oluştuktan sonra her biri ayrı
      // bir varyant olarak kaydedilir (mevcut /vendor/products/{id}/variants
      // uç noktası, bkz. edit-product.tsx aynı desen). Renk boş bırakılan
      // satırlar atlanır.
      for (const row of colorRows) {
        if (!row.color.trim()) continue;
        try {
          await mutateJson(`/vendor/products/${product.id}/variants`, "POST", {
            color: row.color.trim(),
            size: row.size.trim() || undefined,
            stock: Number(row.stock) || 0,
          });
        } catch {
          /* tek varyant hatası ürünü engellemez, düzenleme sayfasından tekrar denenebilir */
        }
      }

      // Ürün oluştu; seçilen görselleri sırayla yükle. Tek bir görsel
      // başarısız olsa da ürün oluşturuldu - kullanıcı düzenleme sayfasından
      // tekrar deneyebilir.
      for (let i = 0; i < images.length; i++) {
        setUploadStatus(`Görsel yükleniyor ${i + 1}/${images.length}...`);
        try {
          await uploadFile(`/vendor/products/${product.id}/images`, images[i].file);
        } catch {
          /* tek görsel hatası ürünü engellemez */
        }
      }

      if (video) {
        setUploadStatus("Video yükleniyor...");
        try {
          await uploadFile(`/vendor/products/${product.id}/video`, video);
        } catch {
          /* video hatası ürünü engellemez, düzenleme sayfasından tekrar denenebilir */
        }
      }

      images.forEach((img) => URL.revokeObjectURL(img.url));
      router.push(`/satici/panel/urunler/${product.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Ürün oluşturulamadı");
      setLoading(false);
      setUploadStatus(null);
    }
  }

  const imagesBlock = (
    <div className="fg">
      <label>Ürün Görselleri</label>
      <div className="file-drop">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={(e) => handleAddImages(e.target.files)}
        />
        <i className="fas fa-images" />
        <p>Görsel seçmek için tıklayın veya sürükleyin</p>
        <small>JPG, PNG, WEBP, GIF · birden fazla seçebilirsiniz · ilki vitrin görseli olur</small>
      </div>
      {images.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {images.map((img, i) => (
            <div key={img.url} style={{ position: "relative", width: 92 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: i === 0 ? "2px solid var(--pr)" : "1px solid var(--br)" }}
              />
              {i === 0 && (
                <span style={{ position: "absolute", top: 4, left: 4, background: "var(--pr)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 6 }}>
                  Vitrin
                </span>
              )}
              <button
                type="button"
                onClick={() => removeImage(i)}
                title="Kaldır"
                style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(226,59,82,.9)", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const videoBlock = (
    <div className="fg">
      <label>Ürün Videosu (opsiyonel)</label>
      <div className="file-drop">
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
        />
        <i className="fas fa-video" />
        <p>{video ? video.name : "Kısa tanıtım videosu ekleyin"}</p>
        <small>MP4, WEBM, MOV · en fazla 50MB</small>
      </div>
    </div>
  );

  if (!isIndividual) {
    return (
      <div className="card">
        <div className="ch">
          <h3>Yeni Ürün</h3>
        </div>
        <form className="fc" style={{ padding: "20px" }} onSubmit={handleSubmit}>
          <div className="fg">
            <label>Kategori</label>
            <select className="fi" required value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              <option value="">Seçin...</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Ürün Adı</label>
            <input className="fi" required value={name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div className="fg">
            <label>Ürün Adresi</label>
            <input
              className="fi"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="fg">
            <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <span>Açıklama</span>
              <button
                type="button"
                onClick={handleEnrich}
                disabled={enriching || name.trim().length < 1}
                title="Ürün adına göre açıklama ve kategori önerisi doldurur"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--color-primary, #8a1c4d)",
                  background: enriching ? "var(--color-primary, #8a1c4d)" : "transparent",
                  color: enriching ? "#fff" : "var(--color-primary, #8a1c4d)",
                  cursor: enriching || name.trim().length < 1 ? "default" : "pointer",
                  opacity: name.trim().length < 1 ? 0.5 : 1,
                }}
              >
                {enriching ? "Dolduruluyor…" : "✨ Otomatik doldur"}
              </button>
            </label>
            <textarea
              className="fi"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürününüzü müşterilerinize tanıtın (opsiyonel)"
            />
          </div>
          <div className="row2">
            <div className="fg">
              <label>Marka</label>
              <input className="fi" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div className="fg">
              <label>Fiyat (₺)</label>
              <input className="fi" type="number" required min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
          </div>
          <div className="fg">
            <label>İndirimli Fiyat (₺)</label>
            <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
          </div>

          <div className="fg">
            <label>Renkler &amp; Stok</label>
            {colorRows.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
                {colorRows.map((row) => (
                  <div key={row.key} className="row4" style={{ alignItems: "flex-end" }}>
                    <div className="fg">
                      <label>Renk</label>
                      <input className="fi" value={row.color} onChange={(e) => updateColorRow(row.key, "color", e.target.value)} placeholder="ör. Kırmızı" />
                    </div>
                    <div className="fg">
                      <label>Beden</label>
                      <input className="fi" value={row.size} onChange={(e) => updateColorRow(row.key, "size", e.target.value)} placeholder="Opsiyonel" />
                    </div>
                    <div className="fg">
                      <label>Stok</label>
                      <input className="fi" type="number" min={0} value={row.stock} onChange={(e) => updateColorRow(row.key, "stock", e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeColorRow(row.key)}>
                      Sil
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button type="button" className="btn btn-sec btn-sm" onClick={addColorRow}>
                <i className="fas fa-plus" /> Renk Ekle
              </button>
              {colorRows.length > 0 && <span style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Toplam Stok: {totalStock}</span>}
            </div>
            {colorRows.length === 0 && (
              <div style={{ marginTop: 10 }}>
                <label>Stok Adedi</label>
                <input className="fi" type="number" min={1} required value={plainStock} onChange={(e) => setPlainStock(e.target.value)} placeholder="ör. 20" />
                <small style={{ color: "var(--tx3)" }}>Hiç renk eklemezseniz ürün tek seçenek olarak satılır, stok adedi girmeniz zorunludur.</small>
              </div>
            )}
          </div>

          {imagesBlock}
          {videoBlock}

          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" type="submit" disabled={loading} style={{ alignSelf: "flex-start" }}>
            {loading ? uploadStatus ?? "Kaydediliyor..." : "Ürünü Oluştur"}
          </button>
        </form>
      </div>
    );
  }

  // --- Bireysel satıcı: adım adım sihirbaz ---
  const canAdvance =
    step === 0 ? images.length > 0 : step === 1 ? categoryId !== "" && name.trim().length > 1 : step === 2 ? basePrice !== "" && Number(basePrice) > 0 : true;
  const categoryName = categories.find((c) => c.id === categoryId)?.name;
  const isLastStep = step === WIZARD_STEPS.length - 1;

  return (
    <div className="card">
      <div className="ch">
        <h3>Yeni Ürün</h3>
      </div>

      <div className="wizard-steps">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className={`wizard-step${i === step ? " active" : ""}${i < step ? " done" : ""}`}>
            <span className="wizard-step-dot">{i < step ? <i className="fas fa-check" /> : i + 1}</span>
            <span className="wizard-step-label">{label}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <div key={step} className="wizard-panel fc" style={{ padding: "20px" }}>
          {step === 0 && (
            <>
              {imagesBlock}
              {videoBlock}
            </>
          )}

          {step === 1 && (
            <>
              <div className="fg">
                <label>Kategori</label>
                <select className="fi" required value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
                  <option value="">Seçin...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fg">
                <label>Ürün Adı</label>
                <input className="fi" required value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="ör. Çiçek Desenli Yazlık Elbise" />
              </div>
              <div className="fg">
                <label>Marka</label>
                <input className="fi" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
              </div>
              <div className="fg">
                <label>Açıklama</label>
                <textarea
                  className="fi"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kumaş, kalıp, kullanım durumu... (opsiyonel)"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="fg">
                <label>Fiyat (₺)</label>
                <input className="fi" type="number" required min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="0.00" />
              </div>
              <div className="fg">
                <label>İndirimli Fiyat (₺)</label>
                <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
              </div>
              <div className="fg">
                <label>Ürün Durumu</label>
                <div className="wizard-condition">
                  <button type="button" className={`wizard-condition-btn${!isSecondHand ? " active" : ""}`} onClick={() => setIsSecondHand(false)}>
                    <i className="fas fa-sparkles" /> Sıfır
                  </button>
                  <button type="button" className={`wizard-condition-btn${isSecondHand ? " active" : ""}`} onClick={() => setIsSecondHand(true)}>
                    <i className="fas fa-recycle" /> 2. El
                  </button>
                </div>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="wizard-preview">
              {images[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[0].url} alt="" className="wizard-preview-img" />
              )}
              <div className="wizard-preview-body">
                <h4>{name || "Ürün adı"}</h4>
                <div className="wizard-preview-price">
                  {basePrice ? `${Number(basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺` : "—"}
                </div>
                <div className="wizard-preview-tags">
                  {categoryName && <span className="st st-muted">{categoryName}</span>}
                  <span className="st st-muted">{isSecondHand ? "2. El" : "Sıfır"}</span>
                  <span className="st st-muted">{images.length} fotoğraf</span>
                </div>
                <p className="wizard-preview-hint">
                  Her şey doğru görünüyorsa <strong>Yayınla</strong>ya bas - ürünün admin onayından sonra sitede
                  görünür.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ color: "var(--er)", fontSize: "0.85rem", padding: "0 20px" }}>{error}</p>}

        <div className="wizard-nav">
          <button type="button" className="btn btn-sec" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || loading}>
            <i className="fas fa-arrow-left" /> Geri
          </button>
          {isLastStep ? (
            <button type="submit" className="btn btn-pr btn-lg" disabled={loading}>
              {loading ? uploadStatus ?? "Yayınlanıyor..." : "Yayınla"}
            </button>
          ) : (
            <button type="button" className="btn btn-pr" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              İleri <i className="fas fa-arrow-right" />
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
