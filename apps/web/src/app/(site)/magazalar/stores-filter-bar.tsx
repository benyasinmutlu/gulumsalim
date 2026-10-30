"use client";

import { useRef } from "react";

const SORT_OPTIONS = [
  { value: "newest", label: "Yeni Katılanlar" },
  { value: "rating", label: "En Yüksek Puan" },
  { value: "products", label: "En Çok Ürün" },
  { value: "followers", label: "En Çok Takipçi" },
  { value: "name", label: "İsme Göre (A-Z)" },
];

export default function StoresFilterBar({ s, sort, verified }: { s?: string; sort: string; verified?: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} className="store-discover-filters" method="GET" action="/magazalar">
      {s && <input type="hidden" name="s" value={s} />}
      <select name="sort" className="store-discover-select" defaultValue={sort} onChange={() => formRef.current?.submit()}>
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label className="store-discover-toggle">
        <input type="checkbox" name="verified" value="1" defaultChecked={verified === "1"} onChange={() => formRef.current?.submit()} />
        Sadece Doğrulanmış Mağazalar
      </label>
    </form>
  );
}
