"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import ProductCard from "@/components/product-card";
import type { ProductListItem, ProductListResponse } from "@/lib/types";
import type { ProductListingParams } from "@/components/product-listing";

// Sunucu ilk sayfayı (keyset cursor API'sinden) render eder; buradan itibaren
// istemci, kullanıcı listenin sonuna yaklaştıkça AYNI filtrelerle bir sonraki
// cursor sayfasını çekip ekler (bkz. docs/specs f3 ölçek denetimi - backend
// değişmez, mevcut /products?cursor= uçları kullanılır). 100k+ üründe bile
// sabit maliyetli keyset seek olduğu için sonsuz kaydırma güvenli.
function buildQuery(params: ProductListingParams, cursor: string): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "cursor") q.set(key, value);
  }
  q.set("cursor", cursor);
  return q.toString();
}

interface Props {
  initialItems: ProductListItem[];
  initialCursor: string | null;
  params: ProductListingParams;
}

export default function ProductListingGrid({ initialItems, initialCursor, params }: Props) {
  const [items, setItems] = useState<ProductListItem[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [loading, setLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Filtre değişince sunucu yeni initial props ile yeniden render eder -
  // istemci listesini sıfırla.
  useEffect(() => {
    setItems(initialItems);
    setCursor(initialCursor);
  }, [initialItems, initialCursor]);

  const loadMore = useCallback(async () => {
    if (loading || !cursor) return;
    setLoading(true);
    try {
      const res = await fetchJson<ProductListResponse>(`/products?${buildQuery(params, cursor)}`);
      setItems((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.items.filter((p) => !seen.has(p.id))];
      });
      setCursor(res.nextCursor);
    } catch {
      // Sessiz geç - kullanıcı butonla tekrar deneyebilir.
    } finally {
      setLoading(false);
    }
  }, [loading, cursor, params]);

  // Sona ~600px kala otomatik yükle (buton da her zaman bir yedek olarak durur).
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "600px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <>
      <div className="products-count">
        {items.length} ürün{cursor ? " gösteriliyor — kaydırdıkça daha fazlası yüklenir" : " listelendi"}
      </div>

      {items.length === 0 ? (
        <p className="empty-state">Bu filtrede ürün bulunamadı.</p>
      ) : (
        <div className="product-grid" id="productGrid">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {cursor && (
        <div ref={sentinelRef} className="load-more-row">
          <button type="button" className="btn btn-secondary btn-lg load-more-btn" onClick={loadMore} disabled={loading}>
            {loading ? (
              <>
                <span className="load-more-spinner" aria-hidden /> Yükleniyor…
              </>
            ) : (
              <>
                <i className="fas fa-arrow-down" /> Daha Fazla Ürün
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}
