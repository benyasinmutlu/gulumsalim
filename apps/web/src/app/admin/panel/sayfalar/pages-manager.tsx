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
    setError(null);
  }

  function startEdit(page: AdminPage) {
    setEditing(page);
    setTitle(page.title);
    setSlug(page.slug);
    setSlugTouched(true);
    setContent(page.content);
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
        await mutateJson(`/admin/pages/${editing.id}`, "PATCH", { title, slug, content });
      } else {
        await mutateJson("/admin/pages", "POST", { title, slug, content });
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

  if (pages === null) return <p style={{ marginTop: "1rem" }}>Yükleniyor...</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "2rem", marginTop: "1.5rem" }}>
      <div>
        {pages.length === 0 ? (
          <p className="empty-state">Henüz sayfa yok.</p>
        ) : (
          <table className="data-table">
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
                  <td style={{ fontSize: "0.8rem", opacity: 0.7 }}>/{p.slug}</td>
                  <td style={{ textAlign: "right" }}>
                    <button className="btn btn-secondary" style={{ fontSize: "0.75rem" }} onClick={() => handleDelete(p.id)}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem" }}>{editing ? `"${editing.title}" düzenleniyor` : "Yeni Sayfa"}</h3>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Başlık
            <input required value={title} onChange={(e) => handleTitleChange(e.target.value)} />
          </label>
          <label>
            Adres (/{slug || "sayfa-adresi"})
            <input
              required
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
            />
          </label>
          <label>
            İçerik
            <textarea
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ padding: "0.55rem 0.7rem", borderRadius: 6, border: "1px solid rgba(128,128,128,0.4)", background: "transparent", color: "inherit", fontFamily: "inherit" }}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <button className="btn" type="submit" disabled={loading}>
              {loading ? "Kaydediliyor..." : editing ? "Güncelle" : "Oluştur"}
            </button>
            {editing && (
              <button type="button" className="btn btn-secondary" onClick={startNew}>
                Vazgeç
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
