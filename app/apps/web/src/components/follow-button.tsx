"use client";

import { useState } from "react";
import { ClientApiError, mutateJson } from "@/lib/client-api";

// gulumsalim.com'daki follow.php'nin karşılığı - .follow-btn CSS'i zaten
// vardı (mağaza sayfası için tasarlanmıştı) ama hiçbir bileşen kullanmıyordu.
// bkz. kullanıcı isteği: "mağazayı takip etmede de hata var" - takip
// butonu doğru çalışıyordu ama yanındaki "Takipçi" sayısı sunucu tarafında
// bir kere render edildiği için tıklayınca güncellenmiyordu, sayfa
// yenilenene kadar eski sayıda donuk kalıyordu (bkz. FollowerCountStat -
// bu buton bir CustomEvent yayınlar, o event'i dinleyip sayıyı günceller).
export default function FollowButton({ vendorSlug, initialFollowing }: { vendorSlug: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await mutateJson<{ following: boolean }>(`/vendors/${vendorSlug}/follow`, "POST");
      setFollowing(result.following);
      window.dispatchEvent(new CustomEvent("vendor-follow-changed", { detail: { delta: result.following ? 1 : -1 } }));
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        // router.push burada GÜVENİLİR DEĞİL (bkz. logout-button.tsx'teki
        // aynı kök sebep) - misafir kullanıcı butona bastığında hiçbir şey
        // olmuyormuş gibi görünüyordu. Tam sayfa yönlendirme bunu çözer.
        window.location.href = `/giris?redirect=${encodeURIComponent(`/${vendorSlug}`)}`;
        return;
      }
      setError("Bir şeyler ters gitti, tekrar deneyin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
      <button type="button" className={`follow-btn${following ? " following" : ""}`} onClick={handleClick} disabled={loading}>
        <i className={following ? "fas fa-check" : "fas fa-plus"} />
        {following ? "Takip Ediliyor" : "Takip Et"}
      </button>
      {error && <span style={{ fontSize: 11, color: "#fff", background: "rgba(220,38,38,.85)", padding: "2px 8px", borderRadius: 6 }}>{error}</span>}
    </div>
  );
}
