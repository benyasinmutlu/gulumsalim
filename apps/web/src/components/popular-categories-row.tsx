import Link from "next/link";
import type { Category } from "../lib/types";

// bkz. kullanıcı isteği (mockup): "Popüler Kategoriler" - anasayfadaki mevcut
// "Kategorilere Göre Alışveriş" bölümünden (categories-section, büyük
// dikdörtgen fotoğraf kartları) KASITLI olarak ayrı - mockup'ta bu daha
// kompakt, dairesel ikon şeridi olarak (popular-vendors-section.tsx'teki
// mağaza avatarlarıyla aynı görsel dilde) ayrıca gösteriliyor. Faz 17'de bu
// bölüm "zaten var olanla çakışır" gerekçesiyle atlanmıştı; kullanıcı
// mockup'a daha sadık kalınmasını istedi.
export default function PopularCategoriesRow({ categories }: { categories: Category[] }) {
  const topLevel = categories.filter((c) => !c.parentId).slice(0, 10);
  if (topLevel.length === 0) return null;

  return (
    <section className="popular-categories-row-section">
      <div className="container">
        <div className="section-header section-header-flex">
          <h2 className="section-title">Popüler Kategoriler</h2>
        </div>
        <div className="popular-categories-row hscroll">
          {topLevel.map((c) => (
            <Link key={c.id} href={`/${c.slug}`} className="popular-category-card">
              <div className="popular-category-avatar">
                {c.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.image} alt={c.name} />
                ) : (
                  <i className={c.icon || "fas fa-tag"} />
                )}
              </div>
              <span className="popular-category-name">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
