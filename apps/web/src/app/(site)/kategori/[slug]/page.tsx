import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetchJson } from "@/lib/api";
import type { Category } from "@/lib/types";
import ProductListing, { type ProductListingParams } from "@/components/product-listing";

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ProductListingParams>;
}

async function findCategoryBySlug(slug: string): Promise<Category | null> {
  try {
    const categories = await apiFetchJson<Category[]>("/categories");
    return categories.find((c) => c.slug === slug) ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) return { title: "Kategori bulunamadı" };
  return { title: `${category.name} | Gülüm Şalım` };
}

// gulumsalim.com'daki .htaccess'teki "^kategori/([a-zA-Z0-9\-_%]+)/?$ ->
// products.php?category=$1" kuralının birebir karşılığı.
export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const category = await findCategoryBySlug(slug);
  if (!category) notFound();

  const query = await searchParams;
  return (
    <ProductListing
      params={{ ...query, category: category.slug }}
      heading={category.name}
      basePath={`/kategori/${category.slug}`}
      lockedCategorySlug={category.slug}
    />
  );
}
