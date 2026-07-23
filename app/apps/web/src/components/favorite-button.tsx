"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, mutateJson } from "../lib/client-api";

// gulumsalim.com'daki .fav-badge'in karşılığı - her zaman görünen (hover
// gerektirmez) favori kalp butonu. Ürün listesi/detay sayfalarında başlangıç
// durumu bilinmediğinden "favorilenmemiş" varsayılır; ama /hesabim/favoriler
// gibi zaten favori olduğu bilinen listelerde initialFavorited ile doğru
// başlangıç durumu geçilir.
export default function FavoriteButton({
  productId,
  initialFavorited = false,
}: {
  productId: number;
  initialFavorited?: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try {
      const result = await mutateJson<{ favorited: boolean }>("/favorites/toggle", "POST", { productId });
      setFavorited(result.favorited);
      // Favori listesi gibi sunucu tarafından render edilen sayfalarda
      // ürünün listeden anında düşmesi/eklenmesi için.
      router.refresh();
    } catch (err) {
      // Giriş yapılmamış ziyaretçi favori butonuna bastığında eskiden
      // sessizce hiçbir şey olmuyordu - gulumsalim.com'da olduğu gibi giriş
      // sayfasına yönlendiriyoruz.
      if (err instanceof ClientApiError && err.status === 401) {
        // router.push burada güvenilir değil (bkz. logout-button.tsx /
        // follow-button.tsx'teki aynı kök sebep) - tam sayfa yönlendirme
        // kullanılıyor.
        window.location.href = `/giris?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      className={`fav-badge${favorited ? " is-favorited" : ""}`}
      onClick={handleClick}
      disabled={loading}
      title="Favorile"
      aria-label="Favorile"
    >
      <i className={favorited ? "fas fa-heart" : "far fa-heart"} />
    </button>
  );
}
