"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import styles from "./feed-sources-panel.module.css";

type Provider = "ikas" | "ticimax" | "tsoft" | "ideasoft" | "generic";
type Mapping = Record<string, string | undefined>;

interface FeedSource {
  id: number;
  name: string;
  provider: Provider;
  format: string;
  feedHost: string;
  status: "active" | "paused" | "error";
  intervalMinutes: number;
  defaultCategoryId: number;
  stockBuffer: number;
  lastSuccessAt: string | null;
  nextSyncAt: string;
  consecutiveFailures: number;
  lastError: string | null;
}

interface Category { id: number; name: string; }
interface Preview {
  needsMapping: false;
  format: "xml" | "csv" | "json";
  mapping: Mapping;
  itemCount: number;
  sample: Array<{ externalKey: string; name: string; price: string; stock: number; size?: string; color?: string }>;
}
interface MappingRequired {
  needsMapping: true;
  format: "xml" | "csv" | "json";
  columns: string[];
  sample: Array<Record<string, string>>;
  message: string;
}

const LABELS: Record<Provider, string> = {
  ikas: "ikas",
  ticimax: "Ticimax",
  tsoft: "T-Soft",
  ideasoft: "IdeaSoft",
  generic: "Diğer / Genel Feed",
};

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("tr-TR") : "Henüz yok";
}

export default function FeedSourcesPanel() {
  const [sources, setSources] = useState<FeedSource[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("ikas");
  const [url, setUrl] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [intervalMinutes, setIntervalMinutes] = useState(60);
  const [stockBuffer, setStockBuffer] = useState(0);
  const [authorized, setAuthorized] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mappingRequired, setMappingRequired] = useState<MappingRequired | null>(null);
  const [mappingDraft, setMappingDraft] = useState<Mapping>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [feedSources, categoryRows] = await Promise.all([
      fetchJson<FeedSource[]>("/vendor/feed-sources"),
      fetchJson<Category[]>("/categories"),
    ]);
    setSources(feedSources);
    setCategories(categoryRows);
  }

  useEffect(() => { void load().catch(() => setSources([])); }, []);

  function basePayload() {
    const hasRequiredMapping = mappingDraft.name && mappingDraft.price && (mappingDraft.externalId || mappingDraft.sku || mappingDraft.barcode);
    return {
      provider,
      format: "auto" as const,
      url: url.trim(),
      authorizationConfirmed: authorized as true,
      ...(hasRequiredMapping ? { mapping: mappingDraft } : {}),
    };
  }

  async function inspect() {
    setBusy("preview");
    setError(null);
    setMessage(null);
    try {
      const result = await mutateJson<Preview | MappingRequired>("/vendor/feed-sources/preview", "POST", basePayload());
      if (result.needsMapping) {
        setMappingRequired(result);
        setPreview(null);
        setMessage("Bu feed’in sütun adları özel. Aşağıdan temel alanları bir kez eşleyin.");
      } else {
        setMappingRequired(null);
        setPreview(result);
        setMessage(`${result.itemCount} ürün güvenli şekilde okundu. Kaydetmeden önce örnekleri kontrol edin.`);
      }
    } catch (err) {
      setPreview(null);
      setMappingRequired(null);
      setMappingDraft({});
      setError(err instanceof ClientApiError ? err.message : "Feed okunamadı.");
    } finally {
      setBusy(null);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setProvider("ikas");
    setUrl("");
    setCategoryId("");
    setIntervalMinutes(60);
    setStockBuffer(0);
    setPreview(null);
    setMappingRequired(null);
    setMappingDraft({});
    setAuthorized(false);
  }

  function editConnection(source: FeedSource) {
    setEditingId(source.id);
    setName(source.name);
    setProvider(source.provider);
    setUrl("");
    setCategoryId(source.defaultCategoryId);
    setIntervalMinutes(source.intervalMinutes);
    setStockBuffer(source.stockBuffer);
    setPreview(null);
    setMappingRequired(null);
    setMappingDraft({});
    setAuthorized(false);
    setMessage("Güvenlik nedeniyle mevcut URL gösterilmez. Yeni resmî URL’yi girip önizleyin; kayıt yenilenirken satış stoğu güvenli biçimde durdurulur.");
    setError(null);
    document.getElementById("merchant-feed-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!preview || !categoryId) return;
    setBusy("save");
    setError(null);
    try {
      await mutateJson(editingId ? `/vendor/feed-sources/${editingId}` : "/vendor/feed-sources", editingId ? "PATCH" : "POST", {
        ...basePayload(),
        name: name.trim(),
        defaultCategoryId: categoryId,
        intervalMinutes,
        stockBuffer,
        missingGraceRuns: 3,
        staleAfterMinutes: Math.max(180, intervalMinutes * 3),
        mapping: preview.mapping,
      });
      const wasEditing = editingId !== null;
      resetForm();
      setMessage(wasEditing
        ? "Feed bağlantısı güvenli biçimde yenilendi ve stoklar durduruldu. Hazır olduğunuzda kaynağı etkinleştirin; ilk tam kontrol otomatik başlar."
        : "Feed kaynağı duraklatılmış olarak kaydedildi. Hazır olduğunuzda etkinleştirin; ilk tam kontrol otomatik başlar.");
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Feed kaynağı kaydedilemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(source: FeedSource, status: "active" | "paused") {
    setBusy(`status-${source.id}`);
    setError(null);
    try {
      await mutateJson(`/vendor/feed-sources/${source.id}/status`, "PATCH", { status });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaynak durumu değiştirilemedi.");
    } finally {
      setBusy(null);
    }
  }

  async function syncNow(source: FeedSource) {
    setBusy(`sync-${source.id}`);
    setError(null);
    setMessage(null);
    try {
      const result = await mutateJson<{ status: string; itemCount: number }>(`/vendor/feed-sources/${source.id}/sync`, "POST");
      setMessage(result.status === "unchanged" ? `${source.name}: değişiklik yok.` : `${source.name}: ${result.itemCount} ürün işlendi.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Senkronizasyon başarısız.");
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2>XML / CSV / JSON ürün akışı</h2>
          <p>Resmî katalog bağlantısından ürün, fiyat ve stoğu periyodik alın. API satın almadan önce bu yöntemi deneyin.</p>
        </div>
        <span className={styles.safeBadge}>Resmî feed • kontrollü çekim</span>
      </div>

      {error && <div className={styles.error} role="alert">{error}</div>}
      {message && <div className={styles.success} role="status">{message}</div>}

      {sources.length > 0 && (
        <div className={styles.sourceList}>
          {sources.map((source) => (
            <article className={styles.sourceCard} key={source.id}>
              <div>
                <div className={styles.sourceTitle}>
                  <strong>{source.name}</strong>
                  <span data-status={source.status}>{source.status === "active" ? "Aktif" : source.status === "paused" ? "Duraklatıldı" : "Hata"}</span>
                </div>
                <p>{LABELS[source.provider]} • {source.feedHost} • {source.intervalMinutes} dakikada bir</p>
                <small>Son başarılı kontrol: {formatDate(source.lastSuccessAt)}</small>
                {source.lastError && <div className={styles.inlineError}>{source.lastError}</div>}
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => syncNow(source)} disabled={busy !== null || source.status === "paused"} title={source.status === "paused" ? "Önce kaynağı etkinleştirin" : undefined}>Şimdi kontrol et</button>
                <button type="button" onClick={() => setStatus(source, source.status === "active" ? "paused" : "active")} disabled={busy !== null}>
                  {source.status === "active" ? "Durdur" : "Etkinleştir"}
                </button>
                <button type="button" onClick={() => editConnection(source)} disabled={busy !== null}>Bağlantıyı yenile</button>
              </div>
            </article>
          ))}
        </div>
      )}

      <form id="merchant-feed-form" onSubmit={save} className={styles.form}>
        <h3>{editingId ? "Feed bağlantısını güvenli yenile" : "Yeni resmî feed ekle"}</h3>
        <div className={styles.grid}>
          <label>Bağlantı adı<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn. ikas ana katalog" required minLength={2} /></label>
          <label>Altyapı<select value={provider} onChange={(e) => { setProvider(e.target.value as Provider); setPreview(null); setMappingRequired(null); setMappingDraft({}); }}>
            {Object.entries(LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
          </select></label>
          <label className={styles.wide}>Resmî feed URL’si<input type="url" value={url} onChange={(e) => { setUrl(e.target.value); setPreview(null); setMappingRequired(null); setMappingDraft({}); }} placeholder="https://magazaniz.com/katalog.xml" required /></label>
          <label>Varsayılan kategori<select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} required>
            <option value="">Seçin…</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select></label>
          <label>Kontrol aralığı<select value={intervalMinutes} onChange={(e) => setIntervalMinutes(Number(e.target.value))}>
            <option value={30}>30 dakika</option><option value={60}>1 saat</option><option value={180}>3 saat</option><option value={360}>6 saat</option>
          </select></label>
          <label>Stok güvenlik payı<input type="number" min={0} max={1000000} value={stockBuffer} onChange={(e) => setStockBuffer(Number(e.target.value))} /></label>
        </div>
        {mappingRequired && (
          <div className={styles.mappingBox}>
            <strong>Feed alanlarını eşle</strong>
            <p>Ürün adı, satış fiyatı ve en az bir sabit kimlik alanı zorunludur.</p>
            <div className={styles.mappingGrid}>
              {([
                ["externalId", "Ürün kimliği"], ["sku", "SKU"], ["barcode", "Barkod"],
                ["name", "Ürün adı *"], ["price", "Satış fiyatı *"], ["compareAtPrice", "Eski fiyat"],
                ["stock", "Stok adedi"], ["availability", "Stok durumu"], ["groupId", "Varyant grup kimliği"],
                ["size", "Beden"], ["color", "Renk"], ["brand", "Marka"],
                ["description", "Açıklama"], ["imageUrl", "Görsel URL’si"],
              ] as const).map(([field, label]) => (
                <label key={field}>{label}<select value={mappingDraft[field] ?? ""} onChange={(e) => { setMappingDraft((current) => ({ ...current, [field]: e.target.value || undefined })); setPreview(null); }}>
                  <option value="">Eşleme yok</option>
                  {mappingRequired.columns.map((column) => <option value={column} key={column}>{column}</option>)}
                </select></label>
              ))}
            </div>
          </div>
        )}
        <label className={styles.consent}>
          <input type="checkbox" checked={authorized} onChange={(e) => { setAuthorized(e.target.checked); setPreview(null); }} />
          Bu bağlantının mağazama ait resmî dışa aktarım/katalog bağlantısı olduğunu ve Gülüm Şalım’ın periyodik okumasına yetkim bulunduğunu onaylıyorum.
        </label>
        <div className={styles.formActions}>
          <button type="button" onClick={inspect} disabled={!url.trim() || !authorized || busy !== null}>{busy === "preview" ? "Kontrol ediliyor…" : "Bağlantıyı önizle"}</button>
          <button type="submit" className={styles.primary} disabled={!preview || !name.trim() || !categoryId || busy !== null}>{busy === "save" ? "Kaydediliyor…" : editingId ? "Bağlantıyı yenile" : "Kaynağı kaydet"}</button>
          {editingId && <button type="button" onClick={resetForm} disabled={busy !== null}>İptal</button>}
        </div>
        {preview && (
          <div className={styles.preview}>
            <strong>{preview.itemCount} ürün • {preview.format.toUpperCase()}</strong>
            {preview.sample.map((item) => <div key={item.externalKey}><span>{item.name}</span><span>{item.price} TL • stok {item.stock}</span></div>)}
          </div>
        )}
      </form>

      <p className={styles.note}>Not: Feed yalnız ürün/fiyat/stok getirir. Sipariş, iade ve kargo aktarımı sağlayıcının resmî API iznine bağlıdır. Kaynak bayatlarsa sistem satışı güvenli tarafta durdurur.</p>
    </section>
  );
}
