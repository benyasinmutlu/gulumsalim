import Link from "next/link";
import type { Category } from "../lib/types";

// Anasayfa hero'sunun solundaki sabit kategori sidebar'ı (mockup'taki gibi) -
// Faz 0'da kurulan üst seviye kategorileri listeler. Admin'in yönettiği
// homepage_sections/homepage_collections akışına dokunmaz, hero satırının
// yanına eklenen ayrı, sabit bir bileşendir.
export default function CategorySidebar({ categories }: { categories: Category[] }) {
  const topLevel = categories.filter((c) => !c.parentId);
  if (topLevel.length === 0) return null;

  return (
    <aside className="home-cat-sidebar">
      <ul>
        {topLevel.map((c) => (
          <li key={c.id}>
            <Link href={`/${c.slug}`}>
              {c.icon && !c.icon.startsWith("fa") ? <span aria-hidden>{c.icon}</span> : <i className={c.icon || "fas fa-tag"} />}
              <span>{c.name}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link href="/urunler" className="home-cat-all">
            <i className="fas fa-grip" />
            <span>Tüm Ürünler</span>
          </Link>
        </li>
      </ul>
    </aside>
  );
}
