import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailView, { getProductMeta } from "@/components/product-detail-view";

interface Props {
  params: Promise<{ slug: string; product: string }>;
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
  if (!view) notFound();
  return view;
}
