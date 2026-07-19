import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import type { ProductDetail } from "@/lib/types";
import AddToCartButton from "./add-to-cart-button";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getProduct(slug: string): Promise<ProductDetail | null> {
  const res = await apiFetch(`/products/${slug}`);
  if (!res.ok) return null;
  return res.json();
}

// Eski PHP sitenin ürün sayfalarındaki SEO yatırımının (canonical, OG,
// açıklama) korunduğu yer burası - Next.js'i seçme sebebimiz tam da bu.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Ürün bulunamadı" };

  return {
    title: `${product.name} | Gülüm Şalım`,
    description: product.description ?? undefined,
    openGraph: {
      title: product.name,
      description: product.description ?? undefined,
      images: product.images[0]?.url ? [product.images[0].url] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ?? undefined,
    offers: {
      "@type": "Offer",
      price: product.basePrice,
      priceCurrency: "TRY",
    },
  };

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p style={{ fontSize: "0.85rem", opacity: 0.65 }}>{product.vendorStoreName}</p>
      <h1 style={{ fontSize: "1.4rem", marginTop: "0.3rem" }}>{product.name}</h1>

      <p style={{ marginTop: "0.75rem" }} className="price">
        {Number(product.basePrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        {product.compareAtPrice && (
          <span className="price-old">
            {Number(product.compareAtPrice).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
          </span>
        )}
      </p>

      {product.description && <p style={{ marginTop: "1rem", maxWidth: 560 }}>{product.description}</p>}

      <AddToCartButton productId={product.id} />
    </main>
  );
}
