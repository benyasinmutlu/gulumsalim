import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import ProductDetailView, { getProductMeta } from "@/components/product-detail-view";
import { apiFetchJson } from "@/lib/api";

interface Props {
  params: Promise<{ slug: string }>;
}

// bkz. denetim raporu: "301 yönlendirmeleri" - ürün adresi (slug)
// değiştiğinde eski bağlantı 404 vermesin (bkz. apps/api
// findRedirectForOldProductSlug).
async function findRedirect(slug: string): Promise<{ slug: string; categorySlug: string | null } | null> {
  try {
    return await apiFetchJson<{ slug: string; categorySlug: string | null }>(`/products/by-old-slug/${slug}`);
  } catch {
    return null;
  }
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
  if (!view) {
    const redirect = await findRedirect(slug);
    if (redirect) permanentRedirect(redirect.categorySlug ? `/${redirect.categorySlug}/${redirect.slug}` : `/urun/${redirect.slug}`);
    notFound();
  }
  return view;
}
