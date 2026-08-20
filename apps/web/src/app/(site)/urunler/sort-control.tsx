"use client";

import { useRouter, useSearchParams } from "next/navigation";

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Önerilen" },
  { value: "newest", label: "En Yeniler" },
  { value: "price-asc", label: "Fiyat: Düşükten Yükseğe" },
  { value: "price-desc", label: "Fiyat: Yüksekten Düşüğe" },
];

// bkz. kullanıcı isteği (mockup): "Sırala" seçici artık kenar çubuğundaki
// filtrelerden ayrı, ürün listesinin üstünde (başlığın yanında) duruyor -
// ProductToolbar'ın filtre state'inden BAĞIMSIZ, doğrudan URL'deki mevcut
// query string'i okuyup/yazıyor (diğer aktif filtreleri bozmadan).
export default function SortControl({ basePath }: { basePath: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSort = searchParams.get("sort") ?? "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("sort", value);
    else params.delete("sort");
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <select className="sort-select" value={currentSort} onChange={(e) => handleChange(e.target.value)}>
      {SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
