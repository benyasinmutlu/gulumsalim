"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { fetchJson } from "../lib/client-api";
import { productUrl, type Category, type ProductListItem, type ProductListResponse, type SearchSuggestion } from "../lib/types";

// bkz. kullanıcı isteği: "arama yerinde efekt ile yazı yazılıp silinsin
// ürünler kategoriler vs olsun" → "websitesindeki ürünleri mağazaları
// gösterceksin orada" → "mağazaları ve kategorileri gösterme" (sadece ürün
// adları kalsın) - arama kutusu boşken placeholder, klasik "daktilo"
// efektiyle sitedeki GERÇEK popüler ürün adlarını (bkz. GET
// /search-highlights) sırayla yazıp siler. İstek tamamlanana kadar (ve
// başarısız olursa) jenerik kelimelere düşer. Kutuda gerçek bir değer
// varken (query dolu) animasyon durur.
const FALLBACK_WORDS = ["ürünleri", "yeni gelenleri", "çok satanları", "indirimdekileri"];
const TYPE_MS = 70;
const DELETE_MS = 35;
const HOLD_MS = 1400;
const NEXT_WORD_MS = 400;

// bkz. denetim raporu madde 16: "Son aramalar" - sunucuda kalıcı bir
// arama geçmişi tablosu gerektirmeden, sadece bu tarayıcıya özel basit bir
// çözüm (gizlilik açısından da daha güvenli - arama geçmişi sunucuya gitmez).
const RECENT_SEARCHES_KEY = "gs-recent-searches";
const RECENT_SEARCHES_MAX = 6;

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(term: string) {
  const trimmed = term.trim();
  if (!trimmed) return;
  try {
    const existing = loadRecentSearches().filter((t) => t.toLocaleLowerCase("tr-TR") !== trimmed.toLocaleLowerCase("tr-TR"));
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify([trimmed, ...existing].slice(0, RECENT_SEARCHES_MAX)));
  } catch {
    /* localStorage dolu/kapalıysa sessizce yoksay - arama akışını bozmasın */
  }
}

function useTypewriterPlaceholder(active: boolean, words: string[]) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active || words.length === 0) return;
    let wordIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    function tick() {
      const full = `${words[wordIndex]} ara...`;
      if (!deleting) {
        charIndex++;
        setText(full.slice(0, charIndex));
        if (charIndex === full.length) {
          deleting = true;
          timeoutId = setTimeout(tick, HOLD_MS);
          return;
        }
        timeoutId = setTimeout(tick, TYPE_MS);
      } else {
        charIndex--;
        setText(full.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          wordIndex = (wordIndex + 1) % words.length;
          timeoutId = setTimeout(tick, NEXT_WORD_MS);
          return;
        }
        timeoutId = setTimeout(tick, DELETE_MS);
      }
    }

    timeoutId = setTimeout(tick, 300);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, words.join("|")]);

  return text;
}

// gulumsalim.com'daki search-suggest.php canlı öneri dropdown'unun
// karşılığı - yazarken 250ms bekleyip (debounce) /search-suggest'e sorar.
// bkz. kullanıcı isteği (2026-09-12): "arama yerinde tümüne tıklayıp seçme
// olayını kaldıralım" - kutunun içine gömülü "Tümü ▾" kategori <select>'i
// kaldırıldı (arama artık her zaman kategori ayrımı olmadan çalışır,
// kategori bazlı gezinme sitenin geri kalanında zaten var).
export default function SearchBox({ autoFocus, categories = [] }: { autoFocus?: boolean; categories?: Category[] }) {
  const router = useRouter();
  const topLevelCategories = categories.filter((c) => !c.parentId);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [typewriterWords, setTypewriterWords] = useState<string[]>(FALLBACK_WORDS);
  const typewriterPlaceholder = useTypewriterPlaceholder(query.length === 0, typewriterWords);
  // bkz. denetim raporu madde 16: "Popüler aramalar" + "Son aramalar" -
  // kutu boşken (henüz bir şey yazılmamışken) odaklanınca gösterilir.
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [emptyPanelOpen, setEmptyPanelOpen] = useState(false);
  // bkz. kullanıcı isteği (2026-09-12): "arama yerinde tümüne tıklayıp seçme
  // olayını kaldıralım, trendyol tarzında olsun fakat özgün olmalı" - kutu
  // boşken odaklanınca artık gerçek çok-satan ürünleri (görsel+fiyat) ve
  // kategori keşif etiketlerini de gösteriyoruz. `/products?sort=best_selling`
  // zaten var olan, anasayfa hero'sunun da kullandığı uç (bkz. (site)/page.tsx
  // getBestSellingProducts) - yeni bir backend endpoint'i GEREKMEDİ.
  const [popularProducts, setPopularProducts] = useState<ProductListItem[]>([]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setEmptyPanelOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchJson<{ products: string[] }>("/search-highlights")
      .then((data) => {
        if (data.products.length > 0) setTypewriterWords(data.products);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
    fetchJson<string[]>("/search-trending")
      .then(setTrendingSearches)
      .catch(() => {});
    fetchJson<ProductListResponse>("/products?sort=best_selling&limit=4")
      .then((res) => setPopularProducts(res.items))
      .catch(() => {});
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      setEmptyPanelOpen(value.trim().length === 0);
      return;
    }
    setEmptyPanelOpen(false);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await fetchJson<SearchSuggestion[]>(`/search-suggest?q=${encodeURIComponent(value.trim())}`);
        setSuggestions(results);
        setOpen(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  // bkz. denetim raporu madde 16: hem "gönder" düğmesine basınca hem bir
  // öneriye tıklanınca son aramalara eklenir.
  function handleSubmit() {
    saveRecentSearch(query);
    setOpen(false);
    setEmptyPanelOpen(false);
  }

  function goToTerm(term: string) {
    saveRecentSearch(term);
    setOpen(false);
    setEmptyPanelOpen(false);
    router.push(`/arama?search=${encodeURIComponent(term)}`);
  }

  function suggestionHref(s: SearchSuggestion) {
    if (s.kind === "product") return `/${s.categorySlug}/${s.slug}`;
    if (s.kind === "category") return `/${s.slug}`;
    return `/${s.storeSlug}`;
  }

  // gulumsalim.com'un arama önerisi CSS'i kategori/ürün için "ss-cat"/"ss-prod"
  // kısaltmalarını kullanıyor (bkz. .ss-item.ss-cat / .ss-item.ss-prod
  // globals.css'te) - "kind" alanının tam adıyla (category/product) karışmasın.
  function suggestionKindClass(kind: SearchSuggestion["kind"]) {
    if (kind === "category") return "ss-cat";
    if (kind === "product") return "ss-prod";
    return "ss-vendor";
  }

  return (
    <div className="search-box" ref={containerRef}>
      <form
        action="/arama"
        onSubmit={handleSubmit}
      >
        <input
          type="text"
          name="search"
          placeholder={typewriterPlaceholder}
          aria-label="Aradığın ürün, kategori veya mağaza"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
            else if (query.trim().length === 0) setEmptyPanelOpen(true);
          }}
          autoComplete="off"
        />
        <button type="submit" aria-label="Ara">
          <i className="fas fa-search" />
        </button>
      </form>

      {emptyPanelOpen &&
        (popularProducts.length > 0 || topLevelCategories.length > 0 || recentSearches.length > 0 || trendingSearches.length > 0) && (
        <div className="search-suggest show search-suggest-empty">
          {popularProducts.length > 0 && (
            <div className="ss-term-group">
              <div className="ss-term-group-header">
                <span className="ss-term-group-label">
                  <i className="fas fa-fire" /> Popüler Ürünler
                </span>
                <Link href="/urunler?sort=best_selling" className="ss-see-all" onClick={() => setEmptyPanelOpen(false)}>
                  Tümünü Gör <i className="fas fa-arrow-right" />
                </Link>
              </div>
              <div className="ss-popular-products">
                {popularProducts.map((p) => {
                  const discountPercent = p.compareAtPrice
                    ? Math.round((1 - Number(p.basePrice) / Number(p.compareAtPrice)) * 100)
                    : null;
                  return (
                    <Link
                      key={p.id}
                      href={productUrl(p)}
                      className="ss-popular-product"
                      onClick={() => setEmptyPanelOpen(false)}
                    >
                      <span className="ss-popular-product-img">
                        {p.primaryImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.primaryImageUrl} alt="" />
                        ) : (
                          <span className="ss-noimg">{p.name.charAt(0)}</span>
                        )}
                        {discountPercent !== null && discountPercent > 0 && (
                          <span className="ss-popular-product-badge">%{discountPercent}</span>
                        )}
                      </span>
                      <span className="ss-popular-product-name">{p.name}</span>
                      <span className="ss-popular-product-price">
                        {Number(p.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
          {topLevelCategories.length > 0 && (
            <div className="ss-term-group">
              <span className="ss-term-group-label">
                <i className="fas fa-compass" /> Keşfet
              </span>
              <div className="ss-term-chips">
                {topLevelCategories.map((c) => (
                  <Link key={c.id} href={`/${c.slug}`} className="ss-term-chip ss-discover-chip" onClick={() => setEmptyPanelOpen(false)}>
                    {c.icon && <i className={c.icon} />} {c.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {recentSearches.length > 0 && (
            <div className="ss-term-group">
              <span className="ss-term-group-label">
                <i className="fas fa-clock-rotate-left" /> Son Aramalar
              </span>
              <div className="ss-term-chips">
                {recentSearches.map((term) => (
                  <button key={term} type="button" className="ss-term-chip" onClick={() => goToTerm(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
          {trendingSearches.length > 0 && (
            <div className="ss-term-group">
              <span className="ss-term-group-label">
                <i className="fas fa-magnifying-glass" /> Popüler Aramalar
              </span>
              <div className="ss-term-chips">
                {trendingSearches.map((term) => (
                  <button key={term} type="button" className="ss-term-chip" onClick={() => goToTerm(term)}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {open && suggestions.length > 0 && (
        <div className="search-suggest show">
          {suggestions.map((s) => (
            <a
              key={`${s.kind}-${s.id}`}
              href={suggestionHref(s)}
              className={`ss-item ${suggestionKindClass(s.kind)}`}
              onClick={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push(suggestionHref(s));
              }}
            >
              {s.kind === "category" && (
                <>
                  <i className="fas fa-tag" />
                  <span>{s.name}</span>
                </>
              )}
              {s.kind === "vendor" && (
                <>
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt="" />
                  ) : (
                    <span className="ss-noimg">
                      <i className="fas fa-store" />
                    </span>
                  )}
                  <span>{s.storeName}</span>
                </>
              )}
              {s.kind === "product" && (
                <>
                  {s.primaryImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.primaryImageUrl} alt="" />
                  ) : (
                    <span className="ss-noimg">{s.name.charAt(0)}</span>
                  )}
                  <div className="ss-prod-info">
                    <span className="ss-prod-name">{s.name}</span>
                    <span className="ss-prod-price">
                      {Number(s.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
                    </span>
                  </div>
                </>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
