import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailView, { getProductMeta } from "@/components/product-detail-view";
import { apiFetchJson } from "@/lib/api";

interface Props {
  params: Promise<{ slug: string; product: string }>;
}

// bkz. denetim raporu: "301 yönlendirmeleri" - bkz. app/(site)/urun/[slug]/
// page.tsx'teki aynı yardımcı fonksiyonun kategorili URL karşılığı.
async function findRedirect(slug: string): Promise<{ slug: string; categorySlug: string | null } | null> {
  try {
    return await apiFetchJson<{ slug: string; categorySlug: string | null }>(`/products/by-old-slug/${slug}`);
  } catch {
    return null;
  }
}

// gulumsalim.com'daki .htaccess yakalayıcı kuralı: "/{kategori-slug}/
// {ürün-slug}" (ör. /alt-giyim/pileli-midi-etek) - kategorili ürünlerin
// asıl SEO URL'i. `slug` burada kategori segmenti (üst [slug]/page.tsx
// rotasıyla aynı dinamik segment adını paylaşmak Next.js'in şartı).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { product } = await params;
  return (await getProductMeta(product)) ?? { title: "Ürün bulunamadı" };
}

export default async function CategoryProductPage({ params }: Props) {
  const { slug, product } = await params;
  const view = await ProductDetailView({ slug: product, expectedCategorySlug: slug });
  if (!view) {
    const redirect = await findRedirect(product);
    if (redirect) permanentRedirect(redirect.categorySlug ? `/${redirect.categorySlug}/${redirect.slug}` : `/urun/${redirect.slug}`);
    notFound();
  }
  return view;
}
