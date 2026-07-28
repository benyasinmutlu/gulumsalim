"use client";

import { useRef, useState } from "react";
import { ClientApiError, mutateJson, uploadFile } from "@/lib/client-api";
import type { BulkImportRowResult } from "@/lib/types";

const TEMPLATE_CSV = "name,basePrice,categorySlug,description,brand,compareAtPrice\nÖrnek Elbise,299.90,elbise,Açıklama metni,Marka Adı,349.90\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "urun-sablonu.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function ResultsTable({ results }: { results: BulkImportRowResult[] }) {
  return (
    <div className="card">
      <div className="ch">
        <h3>Sonuçlar ({results.filter((r) => r.status === "created").length} eklendi)</h3>
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
            {results.map((r) => (
              <tr key={r.row}>
                <td>{r.row}</td>
                <td>{r.name}</td>
                <td>
                  <span className={`st ${r.status === "created" ? "st-success" : "st-warn"}`}>
                    {r.status === "created" ? "Eklendi" : "Atlandı"}
                  </span>
                </td>
                <td style={{ fontSize: "0.8rem", color: "var(--tx3)" }}>{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function BulkImportForm() {
  const [tab, setTab] = useState<"file" | "paste">("file");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Lütfen bir CSV dosyası seçin");
      return;
    }
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const data = await uploadFile<{ results: BulkImportRowResult[] }>("/vendor/products/bulk-import", file);
      setResults(data.results);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Yükleme başarısız oldu");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handlePasteImport() {
    if (!pasteText.trim()) {
      setError("Lütfen tablo verisini yapıştırın");
      return;
    }
    setBusy(true);
    setError(null);
    setResults(null);
    try {
      const data = await mutateJson<{ results: BulkImportRowResult[] }>("/vendor/products/bulk-import/paste", "POST", { csvText: pasteText });
      setResults(data.results);
      setPasteText("");
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "İçe aktarma başarısız oldu");
    } finally {
      setBusy(false);
    }
  }

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
            Sütunlar: <code>name, basePrice, categorySlug, description, brand, compareAtPrice</code> (ilk satır
            başlık olmalı; description/brand/compareAtPrice opsiyoneldir).
          </p>

          <div className="tab-nav" style={{ marginBottom: 16 }}>
            <button type="button" className={`tab-btn ${tab === "file" ? "active" : ""}`} onClick={() => setTab("file")}>
              <i className="fas fa-file-csv" /> Dosya Yükle
            </button>
            <button type="button" className={`tab-btn ${tab === "paste" ? "active" : ""}`} onClick={() => setTab("paste")}>
              <i className="fas fa-paste" /> Excel'den Yapıştır
            </button>
          </div>

          {tab === "file" ? (
            <>
              <div className="file-drop">
                <input ref={fileInputRef} type="file" accept=".csv,text/csv" />
                <i className="fas fa-file-csv" />
                <p>CSV dosyası</p>
                <small>Ürün listesi (.csv)</small>
              </div>
              <button className="btn btn-pr" style={{ marginTop: 12 }} onClick={handleUpload} disabled={busy}>
                {busy ? "Yükleniyor..." : "Yükle"}
              </button>
            </>
          ) : (
            <>
              <textarea
                className="fi"
                rows={8}
                placeholder={"Excel'deki hücreleri kopyalayıp buraya yapıştırın (ilk satır başlık: name, basePrice, categorySlug, ...)"}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button className="btn btn-pr" style={{ marginTop: 12 }} onClick={handlePasteImport} disabled={busy}>
                {busy ? "İçe aktarılıyor..." : "İçe Aktar"}
              </button>
            </>
          )}

          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem", marginTop: 8 }}>{error}</p>}
        </div>
      </div>

      {results && <ResultsTable results={results} />}
    </div>
  );
}
