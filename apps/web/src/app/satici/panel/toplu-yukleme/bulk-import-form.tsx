"use client";

import { useState } from "react";
import { ClientApiError, mutateJson, uploadFile } from "@/lib/client-api";
import type { BulkImportRowResult } from "@/lib/types";

const TEMPLATE_CSV =
  "name,basePrice,categorySlug,description,brand,compareAtPrice\nÖrnek Elbise,299.90,elbise,Açıklama metni,Marka Adı,349.90\n";

// [alan, etiket, zorunlu mu]
const FIELDS: [string, string, boolean][] = [
  ["name", "Ürün Adı", true],
  ["basePrice", "Fiyat", true],
  ["categorySlug", "Kategori", true],
  ["description", "Açıklama", false],
  ["brand", "Marka", false],
  ["compareAtPrice", "İndirimli Fiyat", false],
];

type Mapping = Record<string, string>;

interface DetectResult {
  columns: string[];
  autoMap: Mapping;
  sample: Record<string, string>[];
}

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "urun-sablonu.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function statusMeta(s: BulkImportRowResult["status"]): { cls: string; label: string } {
  if (s === "created") return { cls: "st-success", label: "Eklendi" };
  if (s === "valid") return { cls: "st-info", label: "Geçerli" };
  return { cls: "st-warn", label: "Atlandı" };
}

function ResultsTable({ results, preview }: { results: BulkImportRowResult[]; preview: boolean }) {
  const ok = results.filter((r) => r.status === "created" || r.status === "valid").length;
  const skipped = results.length - ok;
  return (
    <div className="card">
      <div className="ch">
        <h3>
          {preview ? "Önizleme" : "Sonuçlar"} — {ok} {preview ? "geçerli" : "eklendi"}
          {skipped > 0 && `, ${skipped} atlandı`}
        </h3>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Satır</th>
              <th>Ad</th>
              <th>Durum</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const m = statusMeta(r.status);
              return (
                <tr key={`${r.row}-${r.name}`}>
                  <td>{r.row}</td>
                  <td>{r.name}</td>
                  <td>
                    <span className={`st ${m.cls}`}>{m.label}</span>
                  </td>
                  <td style={{ fontSize: "0.8rem", color: "var(--tx3)" }}>{r.reason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BulkImportForm() {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [file, setFile] = useState<File | null>(null);
  const [columns, setColumns] = useState<string[] | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);
  const [isPreview, setIsPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetResults() {
    setResults(null);
    setIsPreview(false);
    setError(null);
  }

  // Dosya seçilince: ham sütunları algıla + otomatik eşlemeyi doldur.
  async function handleFile(f: File | null) {
    setFile(f);
    setColumns(null);
    setMapping({});
    resetResults();
    if (!f) return;
    setBusy(true);
    try {
      const d = await uploadFile<DetectResult>("/vendor/products/bulk-import?detect=1", f);
      setColumns(d.columns ?? []);
      setMapping(d.autoMap ?? {});
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Dosya okunamadı");
    } finally {
      setBusy(false);
    }
  }

  function setField(field: string, value: string) {
    setMapping((m) => {
      const n = { ...m };
      if (value) n[field] = value;
      else delete n[field];
      return n;
    });
    resetResults();
  }

  const mappingReady = !!(mapping.name && mapping.basePrice && mapping.categorySlug);

  async function runFile(dryRun: boolean) {
    if (!file) {
      setError("Lütfen bir dosya seçin");
      return;
    }
    if (!mappingReady) {
      setError("Ürün Adı, Fiyat ve Kategori sütunlarını eşlemelisiniz.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const mq = encodeURIComponent(JSON.stringify(mapping));
      const url = `/vendor/products/bulk-import?mapping=${mq}${dryRun ? "&dryRun=1" : ""}`;
      const data = await uploadFile<{ results: BulkImportRowResult[] }>(url, file);
      setResults(data.results);
      setIsPreview(dryRun);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "İşlem başarısız oldu");
    } finally {
      setBusy(false);
    }
  }

  async function runPaste(dryRun: boolean) {
    if (!pasteText.trim()) {
      setError("Lütfen tablo verisini yapıştırın");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await mutateJson<{ results: BulkImportRowResult[] }>("/vendor/products/bulk-import/paste", "POST", {
        csvText: pasteText,
        dryRun,
      });
      setResults(data.results);
      setIsPreview(dryRun);
      if (!dryRun) setPasteText("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "İşlem başarısız oldu");
    } finally {
      setBusy(false);
    }
  }

  const validCount = results?.filter((r) => r.status === "valid").length ?? 0;

  return (
    <div>
      <div className="card">
        <div className="ch" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Toplu Ürün Yükle</h3>
          <button className="btn btn-sec btn-sm" onClick={downloadTemplate} type="button">
            <i className="fas fa-download" /> Şablon İndir
          </button>
        </div>
        <div className="card-body">
          <p style={{ fontSize: "0.85rem", color: "var(--tx3)", marginBottom: 12 }}>
            <strong>CSV, Excel (.xlsx), JSON, JSONL</strong> kabul edilir. Dosyanı seç → sütunlar otomatik eşlenir (gerekiyorsa
            elle değiştir) → <strong>Önizle</strong> → <strong>Onayla ve Yükle</strong>. Sütun adların ne olursa olsun eşleyebilirsin.
          </p>

          <div className="tab-nav" style={{ marginBottom: 16 }}>
            <button type="button" className={`tab-btn ${tab === "file" ? "active" : ""}`} onClick={() => setTab("file")}>
              <i className="fas fa-file-arrow-up" /> Dosya Yükle
            </button>
            <button type="button" className={`tab-btn ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>
              <i className="fas fa-paste" /> Excel&apos;den Yapıştır
            </button>
          </div>

          {tab === "file" ? (
            <>
              <div className="file-drop">
                <input
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls,.json,.jsonl,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                />
                <i className="fas fa-file-arrow-up" />
                <p>{file ? file.name : "Dosya seçmek için tıklayın"}</p>
                <small>CSV · Excel (.xlsx) · JSON · JSONL</small>
              </div>

              {columns && (
                <div style={{ marginTop: 16, border: "1px solid var(--br)", borderRadius: 12, padding: 16, background: "var(--bg)" }}>
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
                    <i className="fas fa-diagram-project" /> Sütun Eşleme
                    <span style={{ fontWeight: 400, color: "var(--tx3)" }}> — dosyandaki {columns.length} sütun algılandı</span>
                  </p>
                  {FIELDS.map(([field, label, req]) => (
                    <div key={field} className="row2" style={{ alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 13, fontWeight: 600 }}>
                        {label}
                        {req && <span style={{ color: "var(--er)" }}> *</span>}
                      </label>
                      <select className="fi" value={mapping[field] ?? ""} onChange={(e) => setField(field, e.target.value)}>
                        <option value="">— seçilmedi —</option>
                        {columns.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-sec" onClick={() => runFile(true)} disabled={busy || !file || !mappingReady}>
                  {busy ? "İşleniyor..." : "Önizle"}
                </button>
                {isPreview && validCount > 0 && (
                  <button className="btn btn-pr" onClick={() => runFile(false)} disabled={busy}>
                    <i className="fas fa-check" /> Onayla ve Yükle ({validCount})
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <textarea
                className="fi"
                rows={8}
                placeholder={"Excel'deki hücreleri kopyalayıp buraya yapıştırın (ilk satır başlık). Sütunlar otomatik eşlenir."}
                value={pasteText}
                onChange={(e) => {
                  setPasteText(e.target.value);
                  resetResults();
                }}
              />
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <button className="btn btn-sec" onClick={() => runPaste(true)} disabled={busy || !pasteText.trim()}>
                  {busy ? "İşleniyor..." : "Önizle"}
                </button>
                {isPreview && validCount > 0 && (
                  <button className="btn btn-pr" onClick={() => runPaste(false)} disabled={busy}>
                    <i className="fas fa-check" /> Onayla ve İçe Aktar ({validCount})
                  </button>
                )}
              </div>
            </>
          )}

          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
        </div>
      </div>

      {results && <ResultsTable results={results} preview={isPreview} />}
    </div>
  );
}
