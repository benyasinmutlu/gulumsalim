"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientApiError, fetchJson, mutateJson } from "@/lib/client-api";
import type { AdminPage } from "@/lib/types";

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

export default function PagesManager() {
  const [pages, setPages] = useState<AdminPage[] | null>(null);
  const [editing, setEditing] = useState<AdminPage | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [content, setContent] = useState("");
  const [showInFooter, setShowInFooter] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setPages(await fetchJson<AdminPage[]>("/admin/pages"));
  }

  useEffect(() => {
    load();
  }, []);

  function startNew() {
    setEditing(null);
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setContent("");
    setShowInFooter(true);
    setError(null);
  }

  function startEdit(page: AdminPage) {
    setEditing(page);
    setTitle(page.title);
    setSlug(page.slug);
    setSlugTouched(true);
    setContent(page.content);
    setShowInFooter(page.showInFooter);
    setError(null);
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editing) {
        await mutateJson(`/admin/pages/${editing.id}`, "PATCH", { title, slug, content, showInFooter });
      } else {
        await mutateJson("/admin/pages", "POST", { title, slug, content, showInFooter });
      }
      startNew();
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Kaydedilemedi");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Bu sayfa silinsin mi?")) return;
    await mutateJson(`/admin/pages/${id}`, "DELETE");
    if (editing?.id === id) startNew();
    await load();
  }

  return (
    <div className="admin-form-row">
      <div className="admin-card">
        <div className="admin-card-header">
          <h2>Sayfalar</h2>
        </div>
        {pages === null ? (
          <div className="admin-card-body">Yükleniyor...</div>
        ) : pages.length === 0 ? (
          <div className="admin-empty">
            <i className="fas fa-file-alt" />
            <h3>Henüz sayfa yok</h3>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Başlık</th>
                  <th>Adres</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <a href="#" onClick={(e) => { e.preventDefault(); startEdit(p); }}>
                        {p.title}
                      </a>
                    </td>
                    <td style={{ fontSize: "0.8rem", color: "var(--admin-text-muted)" }}>/{p.slug}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => handleDelete(p.id)}>
                        Sil
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-card">
        <div className="admin-card-header">
          <h2>{editing ? `"${editing.title}" düzenleniyor` : "Yeni Sayfa"}</h2>
        </div>
        <form className="admin-card-body" onSubmit={handleSubmit}>
          <div className="admin-form-group">
            <label>Başlık</label>
            <input className="admin-form-control" required value={title} onChange={(e) => handleTitleChange(e.target.value)} />
          </div>
          <div className="admin-form-group">
            <label>Adres (/{slug || "sayfa-adresi"})</label>
            <input
              className="admin-form-control"
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="admin-form-group">
            <label>İçerik</label>
            <textarea
              className="admin-form-control"
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="admin-form-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={showInFooter} onChange={(e) => setShowInFooter(e.target.checked)} style={{ width: "auto" }} />
            <label style={{ marginBottom: 0 }}>Footer&apos;da göster</label>
          </div>
          {error && <p className="error-text" style={{ color: "var(--admin-error)" }}>{error}</p>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="admin-btn admin-btn-primary" type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : editing ? "Güncelle" : "Oluştur"}
            </button>
            {editing && (
              <button type="button" className="admin-btn admin-btn-secondary" onClick={startNew}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
