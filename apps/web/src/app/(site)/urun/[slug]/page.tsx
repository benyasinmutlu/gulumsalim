import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailView, { getProductMeta } from "@/components/product-detail-view";

interface Props {
  params: Promise<{ slug: string }>;
}

// Eski PHP sitenin ürün sayfalarındaki SEO yatırımının (canonical, OG,
// açıklama) korunduğu yer burası - Next.js'i seçme sebebimiz tam da bu.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return (await getProductMeta(slug)) ?? { title: "Ürün bulunamadı" };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const view = await ProductDetailView({ slug });
  if (!view) notFound();
  return view;
}
