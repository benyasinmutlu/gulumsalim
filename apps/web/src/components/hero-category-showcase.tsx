import Link from "next/link";

export interface HeroCategoryShowcaseItem {
  id: number;
  name: string;
  slug: string;
  image: string;
}

export default function CategoryShowcaseStrip({ categories }: { categories: HeroCategoryShowcaseItem[] }) {
  if (categories.length === 0) return null;
  return (
    <section className="category-strip" aria-label="Kategoriler">
      <div className="container-hero">
        <div className="category-strip-grid">
          {categories.map((c) => (
            <Link key={c.id} href={`/${c.slug}`} className="category-strip-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.image} alt={c.name} loading="lazy" className="category-strip-img" />
              <span className="category-strip-overlay" />
              <span className="category-strip-name">{c.name}</span>
              <span className="category-strip-arrow" aria-hidden>
                <i className="fas fa-arrow-right" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
