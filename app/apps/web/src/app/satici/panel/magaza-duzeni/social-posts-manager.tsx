"use client";

import { useEffect, useState } from "react";
import { ClientApiError, fetchJson, mutateJson, uploadFile } from "@/lib/client-api";
import type { VendorSocialPost } from "@/lib/types";

const PLATFORM_LABEL: Record<VendorSocialPost["platform"], string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const PLATFORM_ICON: Record<VendorSocialPost["platform"], string> = {
  instagram: "fa-instagram",
  tiktok: "fa-tiktok",
  youtube: "fa-youtube",
};

interface Props {
  onSaved?: () => void;
}

export default function SocialPostsManager({ onSaved }: Props) {
  const [posts, setPosts] = useState<VendorSocialPost[] | null>(null);
  const [platform, setPlatform] = useState<VendorSocialPost["platform"]>("instagram");
  const [postUrl, setPostUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setPosts(await fetchJson<VendorSocialPost[]>("/vendor/social-posts"));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImageSelect(file: File) {
    setUploading(true);
    setError(null);
    try {
      const result = await uploadFile<{ url: string }>("/vendor/social-posts/upload-image", file);
      setImageUrl(result.url);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Görsel yüklenemedi");
    } finally {
      setUploading(false);
    }
  }

  async function handleAdd() {
    if (!postUrl.trim()) {
      setError("Lütfen gönderi bağlantısını girin");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await mutateJson("/vendor/social-posts", "POST", { platform, postUrl: postUrl.trim(), image: imageUrl ?? undefined, caption: caption || undefined });
      setPostUrl("");
      setCaption("");
      setImageUrl(null);
      await load();
      onSaved?.();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Gönderi eklenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    await mutateJson(`/vendor/social-posts/${id}`, "DELETE");
    await load();
    onSaved?.();
  }

  return (
    <div className="card">
      <div className="ch">
        <h3>Sosyal Medya Gönderileri</h3>
      </div>
      <div className="card-body">
        <p style={{ fontSize: "0.85rem", color: "var(--tx3)", marginBottom: 16 }}>
          Mağaza sayfanızın "Sosyal Medya" bölümü görünür olduğunda gösterilecek Instagram/TikTok/YouTube gönderi kartları.
        </p>

        {posts === null ? (
          <p>Yükleniyor...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {posts.map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 12px", background: "var(--s2)", borderRadius: 10 }}>
                <i className={`fab ${PLATFORM_ICON[p.platform]}`} />
                <span style={{ flex: 1, fontSize: "0.85rem" }}>{p.caption || p.postUrl}</span>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>
                  Sil
                </button>
              </div>
            ))}
            {posts.length === 0 && <p style={{ fontSize: "0.85rem", color: "var(--tx3)" }}>Henüz gönderi eklenmedi.</p>}
          </div>
        )}

        <div className="fc" style={{ gap: 10 }}>
          <div className="fg">
            <label>Platform</label>
            <select className="fi" value={platform} onChange={(e) => setPlatform(e.target.value as VendorSocialPost["platform"])}>
              {Object.entries(PLATFORM_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="fg">
            <label>Gönderi Bağlantısı</label>
            <input className="fi" value={postUrl} onChange={(e) => setPostUrl(e.target.value)} placeholder="https://instagram.com/p/..." />
          </div>
          <div className="fg">
            <label>Kapak Görseli (opsiyonel)</label>
            <div className="file-drop">
              <input type="file" accept="image/*" disabled={uploading} onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])} />
              <i className="fas fa-image" />
              <p>Kapak görseli</p>
              <small>PNG, JPG</small>
            </div>
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 6, marginTop: 6 }} />
            )}
          </div>
          <div className="fg">
            <label>Açıklama</label>
            <input className="fi" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Opsiyonel" />
          </div>
          {error && <p style={{ color: "var(--er)", fontSize: "0.85rem" }}>{error}</p>}
          <button className="btn btn-pr" onClick={handleAdd} disabled={saving} style={{ alignSelf: "flex-start" }}>
            {saving ? "Ekleniyor..." : "Gönderi Ekle"}
          </button>
        </div>
      </div>
    </div>
  );
}
