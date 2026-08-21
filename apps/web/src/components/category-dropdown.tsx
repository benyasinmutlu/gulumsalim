"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Category } from "../lib/types";

// Arama kutusunun yanındaki "Kategoriler" açılır menüsü - Faz 0'da kurulan
// üst/alt kategori hiyerarşisini (bkz. categories.parentId) kullanır, alt
// kategorisi olan üst kategoriler hover'da yan panelde alt kategorilerini
// gösterir (mockup'taki gibi).
export default function CategoryDropdown({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const [activeParentId, setActiveParentId] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const topLevel = categories.filter((c) => !c.parentId);
  const childrenByParent = new Map<number, Category[]>();
  for (const c of categories) {
    if (c.parentId) {
      const list = childrenByParent.get(c.parentId) ?? [];
      list.push(c);
      childrenByParent.set(c.parentId, list);
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="header-cat-wrap" ref={wrapRef}>
      <button type="button" className="header-cat-btn" onClick={() => setOpen((v) => !v)}>
        <i className="fas fa-bars" /> Tüm Kategoriler <i className="fas fa-chevron-down header-cat-btn-caret" />
      </button>

      {open && (
        <div className="header-cat-panel">
          <ul className="header-cat-list">
            {topLevel.map((c) => {
              const children = childrenByParent.get(c.id) ?? [];
              return (
                <li
                  key={c.id}
                  className={activeParentId === c.id ? "is-active" : ""}
                  onMouseEnter={() => setActiveParentId(c.id)}
                >
                  <Link href={`/${c.slug}`} onClick={() => setOpen(false)}>
                    <span className="header-cat-thumb">
                      {c.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.image} alt="" />
                      ) : c.icon && !c.icon.startsWith("fa") ? (
                        <span aria-hidden>{c.icon}</span>
                      ) : (
                        <i className={c.icon || "fas fa-tag"} />
                      )}
                    </span>
                    {c.name}
                    {children.length > 0 && <i className="fas fa-chevron-right header-cat-caret" />}
                  </Link>
                  {children.length > 0 && activeParentId === c.id && (
                    <div className="header-cat-sub">
                      {children.map((child) => (
                        <Link key={child.id} href={`/${child.slug}`} onClick={() => setOpen(false)}>
                          <span className="header-cat-thumb">
                            {child.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={child.image} alt="" />
                            ) : child.icon && !child.icon.startsWith("fa") ? (
                              <span aria-hidden>{child.icon}</span>
                            ) : (
                              <i className={child.icon || "fas fa-tag"} />
                            )}
                          </span>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
