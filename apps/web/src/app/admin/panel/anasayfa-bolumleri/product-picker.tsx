"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { ProductListItem } from "@/lib/types";

interface PickedProduct {
  id: number;
  name: string;
}

// admin/homepage-sections.php'deki ürün "sabitleme"/"hariç tutma" ve
// manuel bölüm ürün seçici arayüzünün karşılığı - önceki denetimde bunun
// yerine ham productId dizisi yazılan bir JSON metin kutusu olduğu tespit
// edildi. Arama + ekle + kaldır + yukarı/aşağı taşı (sıra önemliyse).
export default function ProductPicker({
  label,
  ids,
  onChange,
  reorderable = false,
}: {
  label: string;
  ids: number[];
  onChange: (ids: number[]) => void;
  reorderable?: boolean;
}) {
  const [picked, setPicked] = useState<Map<number, string>>(new Map());
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductListItem[]>([]);
  const [searching, setSearching] = useState(false);

  // Daha önce kaydedilmiş ID'lerin adlarını çözmek için - aksi halde
  // düzenleme açıldığında liste sadece "#123" gibi ham ID gösterirdi.
  useEffect(() => {
    const unresolved = ids.filter((id) => !picked.has(id));
    if (unresolved.length === 0) return;
    fetchJson<ProductListItem[]>(`/admin/products/by-ids?ids=${unresolved.join(",")}`).then((rows) => {
      setPicked((m) => {
        const next = new Map(m);
        rows.forEach((r) => next.set(r.id, r.name));
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(",")]);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetchJson<{ items: ProductListItem[] }>(`/products?search=${encodeURIComponent(q.trim())}&limit=8`);
      setResults(res.items);
    } finally {
      setSearching(false);
    }
  }

  function add(product: ProductListItem) {
    if (ids.includes(product.id)) return;
    setPicked((m) => new Map(m).set(product.id, product.name));
    onChange([...ids, product.id]);
    setQuery("");
    setResults([]);
  }

  function remove(id: number) {
    onChange(ids.filter((i) => i !== id));
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...ids];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  function nameFor(id: number): PickedProduct {
    return { id, name: picked.get(id) ?? `#${id}` };
  }

  return (
    <div className="admin-form-group">
      <label>{label}</label>
      <input
        className="admin-form-control"
        placeholder="Ürün ara..."
        value={query}
        onChange={(e) => search(e.target.value)}
      />
      {searching && <p style={{ fontSize: "0.75rem", color: "var(--admin-text-muted)" }}>Aranıyor...</p>}
      {results.length > 0 && (
        <div style={{ border: "1px solid var(--admin-border)", borderRadius: 8, marginTop: 4, maxHeight: 160, overflowY: "auto" }}>
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", fontSize: "0.85rem", border: "none", background: "transparent", cursor: "pointer" }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
      {ids.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
          {ids.map((id, i) => {
            const p = nameFor(id);
            return (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem", background: "var(--admin-surface-2)", borderRadius: 6, padding: "4px 8px" }}>
                {reorderable && (
                  <span style={{ display: "flex", flexDirection: "column" }}>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} style={{ border: "none", background: "none", cursor: "pointer", lineHeight: 1 }}>
                      <i className="fas fa-caret-up" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === ids.length - 1} style={{ border: "none", background: "none", cursor: "pointer", lineHeight: 1 }}>
                      <i className="fas fa-caret-down" />
                    </button>
                  </span>
                )}
                <span style={{ flex: 1 }}>{p.name}</span>
                <button type="button" onClick={() => remove(id)} className="admin-btn admin-btn-danger admin-btn-sm">
                  Kaldır
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
