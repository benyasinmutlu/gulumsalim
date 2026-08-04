"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../lib/client-api";
import type { Category, SearchSuggestion } from "../lib/types";

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
// bkz. kullanıcı isteği (mockup): kategori seçici artık arama kutusunun
// SOLUNDA ayrı bir buton değil, kutunun kendi içine gömülü bir "Tümü ▾"
// açılır listesi - native <select name="category"> olduğu için JS
// gerektirmeden form submit'inde /arama?search=&category= şeklinde gider.
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

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
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

  function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
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
        onSubmit={() => setOpen(false)}
      >
        {topLevelCategories.length > 0 && (
          <select name="category" className="search-box-category" defaultValue="" aria-label="Kategori seç">
            <option value="">Tümü</option>
            {topLevelCategories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input
          type="text"
          name="search"
          placeholder={typewriterPlaceholder}
          aria-label="Aradığın ürün, kategori veya mağaza"
          autoFocus={autoFocus}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
        />
        <button type="submit" aria-label="Ara">
          <i className="fas fa-search" />
        </button>
      </form>

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
