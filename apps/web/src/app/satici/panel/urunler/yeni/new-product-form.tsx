"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { Category, ProductCondition, VendorProduct } from "@/lib/types";
import { PRODUCT_CONDITIONS, isSecondHandCondition } from "@/lib/product-condition";
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

interface EnrichResponse {
  suggestions: {
    title: string | null;
    categoryId: number | null;
    description: string | null;
    attributes: Record<string, string>;
  };
  guidance: { missingInformation: string[]; warnings: string[] };
  sources: Record<string, "ai" | "ml" | "rule">;
}

const WIZARD_STEPS = ["Fotoğraflar", "Bilgiler", "Fiyat", "Yayınla"];
const MAX_PRODUCT_IMAGES = 8;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

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
  // bkz. denetim raporu madde 1: "Ürün kondisyonu zorunlu olmalı" - artık
  // attributes jsonb'sine gömülen serbest metin değil, yapılandırılmış ve
  // zorunlu bir alan (bkz. products.condition, her iki satıcı tipinde de).
  const [condition, setCondition] = useState<ProductCondition | "">("");
  // bkz. denetim raporu madde 2: "Kusur/deformasyon sistemi" - evet ise
  // açıklama VE fotoğraf zorunlu (bkz. handleSubmit doğrulaması).
  const [hasDefect, setHasDefect] = useState(false);
  const [defectDescription, setDefectDescription] = useState("");
  const [defectPhoto, setDefectPhoto] = useState<StagedImage | null>(null);
  const defectPhotoInputRef = useRef<HTMLInputElement>(null);
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
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [sizeChart, setSizeChart] = useState<Record<string, { bust: string; waist: string; hip: string }>>({});
  const [images, setImages] = useState<StagedImage[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [video, setVideo] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [aiFacts, setAiFacts] = useState<Record<string, string>>({});
  const [aiResult, setAiResult] = useState<EnrichResponse | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // Kategoriler yalnızca admin tarafından yönetilir - satıcı yeni kategori
  // OLUŞTURAMAZ (aksi halde her mağaza keyfine göre kategori açardı). Sadece
  // mevcut kategorilerden seçilir.
  useEffect(() => {
    fetchJson<Category[]>("/categories").then(setCategories);
  }, []);

  // bkz. denetim raporu: "Marka yönetimi" - admin onaylı markalar
  // datalist önerisi olarak sunulur, serbest metin girişi kilitlenmez.
  const [brandSuggestions, setBrandSuggestions] = useState<string[]>([]);
  useEffect(() => {
    fetchJson<string[]>("/brands").then(setBrandSuggestions).catch(() => {});
  }, []);

  // Seçilen görseller yüklenmeden önce önizlenir; ürün oluşturulunca hepsi
  // sırayla /vendor/products/{id}/images'a gönderilir. İlk görsel vitrin olur.
  function handleAddImages(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files);
    const invalidType = selected.find((file) => !ALLOWED_IMAGE_TYPES.has(file.type));
    if (invalidType) {
      setError(`${invalidType.name}: yalnız JPG, PNG, WebP veya GIF yükleyebilirsiniz.`);
      return;
    }
    const tooLarge = selected.find((file) => file.size > MAX_IMAGE_BYTES);
    if (tooLarge) {
      setError(`${tooLarge.name}: görsel en fazla 12 MB olabilir.`);
      return;
    }
    if (images.length + selected.length > MAX_PRODUCT_IMAGES) {
      setError(`Bir ürüne en fazla ${MAX_PRODUCT_IMAGES} görsel ekleyebilirsiniz.`);
      return;
    }
    setError(null);
    const next = selected.map((file) => ({ file, url: URL.createObjectURL(file) }));
    setImages((prev) => [...prev, ...next]);
    if (imageInputRef.current) imageInputRef.current.value = "";
  }

  function handleVideo(file: File | undefined) {
    if (!file) {
      setVideo(null);
      return;
    }
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      setError("Yalnız MP4, WebM veya MOV video yükleyebilirsiniz.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError("Video en fazla 50 MB olabilir.");
      return;
    }
    setError(null);
    setVideo(file);
  }

  // bkz. denetim raporu madde 2: kusur fotoğrafı genel galeri görsellerinden
  // ayrı, tekil bir alan - "Bu üründe kusur var" işaretlenince zorunlu.
  function handleDefectPhoto(file: File | undefined) {
    if (!file) {
      setDefectPhoto(null);
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError("Kusur fotoğrafı için yalnız JPG, PNG, WebP veya GIF yükleyebilirsiniz.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Kusur fotoğrafı en fazla 12 MB olabilir.");
      return;
    }
    setError(null);
    if (defectPhoto) URL.revokeObjectURL(defectPhoto.url);
    setDefectPhoto({ file, url: URL.createObjectURL(file) });
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

  const chartSizes = [...new Set(colorRows.map((row) => row.size.trim()).filter(Boolean))];

  function updateSizeChart(label: string, field: "bust" | "waist" | "hip", value: string) {
    setSizeChart((previous) => {
      const current = previous[label] ?? { bust: "", waist: "", hip: "" };
      return { ...previous, [label]: { ...current, [field]: value } };
    });
  }

  function updateAiFact(field: string, value: string) {
    setAiFacts((previous) => ({ ...previous, [field]: value }));
  }

  function buildSizeChart(): Record<string, { bust?: number; waist?: number; hip?: number }> | undefined {
    const result: Record<string, { bust?: number; waist?: number; hip?: number }> = {};
    for (const label of chartSizes) {
      const measurements = sizeChart[label];
      if (!measurements) continue;
      const entry: { bust?: number; waist?: number; hip?: number } = {};
      for (const field of ["bust", "waist", "hip"] as const) {
        const value = Number(measurements[field]);
        if (measurements[field] && Number.isFinite(value) && value >= 30 && value <= 200) entry[field] = value;
      }
      if (Object.keys(entry).length > 0) result[label] = entry;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

  function buildAttributes(): Record<string, string> | undefined {
    const result: Record<string, string> = { ...(aiResult?.suggestions.attributes ?? {}) };
    const mappings = isIndividual
      ? [
          ["size", "Beden"], ["color", "Renk"],
          ["material", "Materyal"], ["usage", "Kullanım"],
        ]
      : [
          ["productType", "Ürün Tipi"], ["material", "Materyal"], ["pattern", "Desen"],
          ["fit", "Kalıp"], ["collection", "Koleksiyon"], ["care", "Bakım"],
          ["targetAudience", "Kullanım Alanı"], ["notableFeatures", "Öne Çıkan Özellikler"],
        ];
    for (const [factKey, label] of mappings) {
      const value = aiFacts[factKey]?.trim();
      if (value) result[label] = value;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }

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
        .join(",") || (isIndividual ? aiFacts.size ?? "" : "");
      const categoryName = categories.find((c) => c.id === categoryId)?.name;
      const facts = isIndividual
        ? {
            condition: PRODUCT_CONDITIONS.find((c) => c.value === condition)?.label,
            usage: aiFacts.usage,
            defects: hasDefect ? defectDescription : "yok",
            color: aiFacts.color,
            material: aiFacts.material,
            pattern: aiFacts.pattern,
          }
        : {
            color: [...new Set(colorRows.map((row) => row.color.trim()).filter(Boolean))].join(", ") || aiFacts.color,
            material: aiFacts.material,
            pattern: aiFacts.pattern,
            fit: aiFacts.fit,
            collection: aiFacts.collection,
            care: aiFacts.care,
            productType: aiFacts.productType,
            targetAudience: aiFacts.targetAudience,
            notableFeatures: aiFacts.notableFeatures,
          };
      const res = await mutateJson<EnrichResponse>(
        "/vendor/products/enrich",
        "POST",
        {
          name,
          description: description || undefined,
          brand: brand || undefined,
          category: categoryName || undefined,
          sizes: sizes || undefined,
          facts: Object.fromEntries(Object.entries(facts).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))),
        },
      );
      setAiResult(res);
      if (!description && res.suggestions.description) setDescription(res.suggestions.description);
      if (categoryId === "" && res.suggestions.categoryId) setCategoryId(res.suggestions.categoryId);
    } catch {
      setError("Otomatik doldurma şu an çalışmadı, elle devam edebilirsiniz.");
    } finally {
      setEnriching(false);
    }
  }

  const aiGuidanceBlock = aiResult && (
    <div style={{ marginTop: 12, border: "1px solid var(--br)", borderRadius: 10, padding: 12, background: "var(--bg2, #fafafa)" }}>
      {aiResult.suggestions.title && aiResult.suggestions.title !== name && (
        <div style={{ marginBottom: 10 }}>
          <strong>Başlık önerisi:</strong> {aiResult.suggestions.title}{" "}
          <button type="button" className="btn btn-sec btn-sm" onClick={() => handleNameChange(aiResult.suggestions.title!)}>Başlığı Kullan</button>
        </div>
      )}
      {Object.keys(aiResult.suggestions.attributes).length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {Object.entries(aiResult.suggestions.attributes).map(([key, value]) => (
            <span key={key} className="st st-muted">{key}: {value}</span>
          ))}
        </div>
      )}
      {aiResult.guidance.missingInformation.length > 0 && (
        <div style={{ color: "var(--tx2)", fontSize: 13, marginTop: 6 }}>
          <strong>İlanı güçlendirmek için:</strong>
          <ul style={{ margin: "5px 0 0 18px" }}>{aiResult.guidance.missingInformation.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      {aiResult.guidance.warnings.length > 0 && (
        <div style={{ color: "var(--er)", fontSize: 13, marginTop: 8 }}>
          <strong>Kontrol et:</strong>
          <ul style={{ margin: "5px 0 0 18px" }}>{aiResult.guidance.warnings.map((item) => <li key={item}>{item}</li>)}</ul>
        </div>
      )}
      <small style={{ display: "block", marginTop: 8, color: "var(--tx3)" }}>
        AI yalnız öneri verir. Yayınlamadan önce tüm bilgileri siz doğrulayın.
      </small>
    </div>
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Sihirbazda ara adımlarda Enter'a basılırsa formu erken göndermesin -
    // sadece son adımda ("Yayınla") gerçekten gönderilir.
    if (isIndividual && step !== WIZARD_STEPS.length - 1) return;
    if (!categoryId) {
      setError("Lütfen bir kategori seçin");
      return;
    }
    if (!condition) {
      setError("Lütfen ürün durumunu seçin");
      return;
    }
    if (hasDefect && defectDescription.trim().length < 5) {
      setError("Kusuru en az birkaç kelimeyle açıklayın");
      return;
    }
    if (hasDefect && !defectPhoto) {
      setError("Kusur/deformasyon fotoğrafı yükleyin");
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
        attributes: buildAttributes(),
        brand: brand || undefined,
        condition,
        hasDefect,
        defectDescription: hasDefect ? defectDescription : undefined,
        basePrice: Number(basePrice),
        compareAtPrice: compareAtPrice ? Number(compareAtPrice) : undefined,
        isSecondHand: isIndividual ? isSecondHandCondition(condition) : false,
        stock: !isIndividual && colorRows.length === 0 ? Number(plainStock) : undefined,
        sizeChart: buildSizeChart(),
      });
      const setupFailures: string[] = [];

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
          setupFailures.push(`${row.color.trim()} varyantı`);
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
          setupFailures.push(`${i + 1}. ürün görseli`);
        }
      }

      if (video) {
        setUploadStatus("Video yükleniyor...");
        try {
          await uploadFile(`/vendor/products/${product.id}/video`, video);
        } catch {
          setupFailures.push("ürün videosu");
        }
      }

      // bkz. denetim raporu madde 2: kusur fotoğrafı, genel görsel yükleme
      // ucuna isDefectPhoto=true sorgu parametresiyle gönderilir (bkz.
      // vendor-products.routes.ts) - ayrı bir endpoint gerekmedi.
      if (hasDefect && defectPhoto) {
        setUploadStatus("Kusur fotoğrafı yükleniyor...");
        try {
          await uploadFile(`/vendor/products/${product.id}/images?isDefectPhoto=true`, defectPhoto.file);
        } catch {
          setupFailures.push("kusur fotoğrafı");
        }
      }

      images.forEach((img) => URL.revokeObjectURL(img.url));
      if (defectPhoto) URL.revokeObjectURL(defectPhoto.url);

      // Ürün çok adımlı kurulum sırasında her zaman taslak başlar. Herhangi
      // bir medya/varyant yüklemesi yarıda kaldıysa eksik ürün otomatik
      // olarak onaya gitmez; kullanıcı düzenleme ekranında tam olarak hangi
      // adımların tekrar gerektiğini görür.
      if (setupFailures.length > 0) {
        const missing = encodeURIComponent(setupFailures.join(", "));
        router.push(`/satici/panel/urunler/${product.id}?setup=incomplete&missing=${missing}`);
        return;
      }

      if (isIndividual) {
        await mutateJson(`/vendor/products/${product.id}`, "PATCH", { status: "pending" });
      }
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
        <small>JPG, PNG, WEBP, GIF · en fazla 8 görsel / görsel başına 12MB · ilki vitrin görseli olur</small>
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
          onChange={(e) => handleVideo(e.target.files?.[0])}
        />
        <i className="fas fa-video" />
        <p>{video ? video.name : "Kısa tanıtım videosu ekleyin"}</p>
        <small>MP4, WEBM, MOV · en fazla 50MB</small>
      </div>
    </div>
  );

  // bkz. denetim raporu madde 1: her iki satıcı tipinde de zorunlu.
  const conditionBlock = (
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
  );

  // bkz. denetim raporu madde 2: "kusur ise açıklama VE fotoğraf zorunlu".
  const defectBlock = (
    <div className="fg">
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={hasDefect} onChange={(e) => setHasDefect(e.target.checked)} style={{ width: "auto" }} />
        Üründe kusur/deformasyon var
      </label>
      {hasDefect && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            className="fi"
            rows={2}
            required
            value={defectDescription}
            onChange={(e) => setDefectDescription(e.target.value)}
            placeholder="Kusuru açıkça tarif edin (ör. sol kolda küçük leke)"
          />
          <div className="file-drop">
            <input
              ref={defectPhotoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => handleDefectPhoto(e.target.files?.[0])}
            />
            <i className="fas fa-camera" />
            <p>{defectPhoto ? defectPhoto.file.name : "Kusuru gösteren fotoğraf yükleyin (zorunlu)"}</p>
          </div>
          {defectPhoto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={defectPhoto.url} alt="" style={{ width: 92, height: 92, objectFit: "cover", borderRadius: 10, border: "1px solid var(--br)" }} />
          )}
        </div>
      )}
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
            <input className="fi" required maxLength={200} value={name} onChange={(e) => handleNameChange(e.target.value)} />
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
          <details className="fg" style={{ border: "1px solid var(--br)", borderRadius: 10, padding: 12 }}>
            <summary style={{ cursor: "pointer", fontWeight: 700 }}>AI katalog brifi (önerilir)</summary>
            <small style={{ display: "block", margin: "6px 0 12px", color: "var(--tx3)" }}>
              Bildiğiniz gerçekleri yazın; AI profesyonel açıklama üretirken bilinmeyen özellikleri uydurmaz.
            </small>
            <div className="row2">
              <div className="fg"><label>Ürün türü</label><input className="fi" value={aiFacts.productType ?? ""} onChange={(e) => updateAiFact("productType", e.target.value)} placeholder="ör. oversize gömlek" /></div>
              <div className="fg"><label>Materyal / kumaş</label><input className="fi" value={aiFacts.material ?? ""} onChange={(e) => updateAiFact("material", e.target.value)} placeholder="Etikette yazdığı şekliyle" /></div>
              <div className="fg"><label>Desen</label><input className="fi" value={aiFacts.pattern ?? ""} onChange={(e) => updateAiFact("pattern", e.target.value)} placeholder="ör. çizgili" /></div>
              <div className="fg"><label>Kalıp</label><input className="fi" value={aiFacts.fit ?? ""} onChange={(e) => updateAiFact("fit", e.target.value)} placeholder="ör. regular fit" /></div>
              <div className="fg"><label>Koleksiyon</label><input className="fi" value={aiFacts.collection ?? ""} onChange={(e) => updateAiFact("collection", e.target.value)} placeholder="Gerçek koleksiyon adı varsa" /></div>
              <div className="fg"><label>Hedef kullanım</label><input className="fi" value={aiFacts.targetAudience ?? ""} onChange={(e) => updateAiFact("targetAudience", e.target.value)} placeholder="ör. günlük, ofis" /></div>
            </div>
            <div className="fg"><label>Bakım bilgisi</label><input className="fi" value={aiFacts.care ?? ""} onChange={(e) => updateAiFact("care", e.target.value)} placeholder="Etiketteki yıkama/bakım bilgisi" /></div>
            <div className="fg"><label>Öne çıkan doğrulanabilir özellikler</label><textarea className="fi" rows={2} value={aiFacts.notableFeatures ?? ""} onChange={(e) => updateAiFact("notableFeatures", e.target.value)} placeholder="Cep, astar, fermuar, ölçü gibi gerçek bilgiler" /></div>
          </details>
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
                  border: "1px solid var(--pr, #111111)",
                  background: enriching ? "var(--pr, #111111)" : "transparent",
                  color: enriching ? "#fff" : "var(--pr, #111111)",
                  cursor: enriching || name.trim().length < 1 ? "default" : "pointer",
                  opacity: name.trim().length < 1 ? 0.5 : 1,
                }}
              >
                {enriching ? "AI dolduruyor…" : "✨ AI ile otomatik doldur"}
              </button>
            </label>
            <textarea
              className="fi"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürününüzü müşterilerinize tanıtın (opsiyonel)"
            />
            {aiGuidanceBlock}
          </div>
          <div className="row2">
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
              <label>Fiyat (₺)</label>
              <input className="fi" type="number" required min={0} step="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} />
            </div>
          </div>
          <div className="fg">
            <label>İndirimli Fiyat (₺)</label>
            <input className="fi" type="number" min={0} step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)} placeholder="Opsiyonel" />
          </div>

          {conditionBlock}
          {defectBlock}

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

          {chartSizes.length > 0 && (
            <div className="fg">
              <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  checked={showSizeChart}
                  onChange={(event) => setShowSizeChart(event.target.checked)}
                  style={{ width: "auto" }}
                />
                Beden ölçü tablosu ekle (opsiyonel)
              </label>
              <small style={{ color: "var(--tx3)" }}>
                Ürününüz standart bedenden dar veya bol kalıpsa her beden için gerçek ölçüleri santimetre olarak girin.
                Müşterinin &quot;Sana Oturur mu?&quot; önerisinde bu değerler kullanılır.
              </small>
              {showSizeChart && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                  {chartSizes.map((label) => (
                    <div key={label} className="row4" style={{ alignItems: "flex-end" }}>
                      <div className="fg">
                        <label>Beden</label>
                        <input className="fi" value={label} disabled style={{ fontWeight: 600 }} />
                      </div>
                      {(["bust", "waist", "hip"] as const).map((field) => (
                        <div className="fg" key={field}>
                          <label>{field === "bust" ? "Göğüs (cm)" : field === "waist" ? "Bel (cm)" : "Kalça (cm)"}</label>
                          <input
                            className="fi"
                            type="number"
                            min={30}
                            max={200}
                            value={sizeChart[label]?.[field] ?? ""}
                            onChange={(event) => updateSizeChart(label, field, event.target.value)}
                            placeholder="—"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
    step === 0
      ? images.length > 0
      : step === 1
        ? categoryId !== "" && name.trim().length > 1 && condition !== ""
        : step === 2
          ? basePrice !== "" && Number(basePrice) > 0
          : true;
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
                <input className="fi" required maxLength={200} value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="ör. Çiçek Desenli Yazlık Elbise" />
              </div>
              <div className="fg">
                <label>Marka</label>
                <input className="fi" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Opsiyonel" />
              </div>
              {conditionBlock}
              <div className="row2">
                <div className="fg"><label>Beden</label><input className="fi" value={aiFacts.size ?? ""} onChange={(e) => updateAiFact("size", e.target.value)} placeholder="ör. M / 38" /></div>
                <div className="fg"><label>Renk</label><input className="fi" value={aiFacts.color ?? ""} onChange={(e) => updateAiFact("color", e.target.value)} placeholder="ör. lacivert" /></div>
                <div className="fg"><label>Materyal</label><input className="fi" value={aiFacts.material ?? ""} onChange={(e) => updateAiFact("material", e.target.value)} placeholder="Yalnız etikette yazıyorsa" /></div>
              </div>
              <div className="fg"><label>Kullanım bilgisi</label><input className="fi" value={aiFacts.usage ?? ""} onChange={(e) => updateAiFact("usage", e.target.value)} placeholder="ör. iki kez kullanıldı" /></div>
              {defectBlock}
              <div className="fg">
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span>Açıklama</span>
                  <button type="button" className="btn btn-sec btn-sm" onClick={handleEnrich} disabled={enriching || name.trim().length < 1}>
                    {enriching ? "AI inceliyor…" : "✨ AI İlan Rehberi"}
                  </button>
                </label>
                <textarea
                  className="fi"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Kumaş, kalıp, kullanım durumu... (opsiyonel)"
                />
                {aiGuidanceBlock}
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
                  {condition && <span className="st st-muted">{PRODUCT_CONDITIONS.find((c) => c.value === condition)?.label}</span>}
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
