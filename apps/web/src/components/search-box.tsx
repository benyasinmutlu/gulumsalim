"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchJson } from "../lib/client-api";
import type { SearchSuggestion } from "../lib/types";

// gulumsalim.com'daki search-suggest.php canlı öneri dropdown'unun
// karşılığı - yazarken 250ms bekleyip (debounce) /search-suggest'e sorar.
export default function SearchBox({ autoFocus }: { autoFocus?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
        <input
          type="text"
          name="search"
          placeholder="Ürün ara..."
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
