import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { apiFetch } from "@/lib/api";
import type { ProductListItem, PublicVendorCollection, PublicVendorProfile } from "@/lib/types";
import ProductCard from "@/components/product-card";

interface Props {
  params: Promise<{ slug: string; collectionSlug: string }>;
}

interface CollectionStorefront {
  vendor: PublicVendorProfile;
  collection: PublicVendorCollection;
  products: ProductListItem[];
}

async function getCollection(slug: string, collectionSlug: string): Promise<CollectionStorefront | null> {
  const res = await apiFetch(`/vendors/${slug}/koleksiyon/${collectionSlug}`);
  if (!res.ok) return null;
  return res.json();
}

// gulumsalim.com'daki /{mağaza-slug}/koleksiyon/{koleksiyon-slug} temiz
// URL'inin karşılığı - satıcının kendi kurduğu koleksiyonun (bkz. satıcı
// panelindeki Koleksiyonlar) tek ürün vitrini sayfası.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, collectionSlug } = await params;
  const data = await getCollection(slug, collectionSlug);
  if (!data) return { title: "Koleksiyon bulunamadı" };
  return { title: `${data.collection.name} | ${data.vendor.storeName} | Gülüm Şalım` };
}

export default async function VendorCollectionPage({ params }: Props) {
  const { slug, collectionSlug } = await params;
  const data = await getCollection(slug, collectionSlug);
  if (!data) notFound();

  const { vendor, collection, products } = data;

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span>
            <Link href={`/${vendor.storeSlug}`}>{vendor.storeName}</Link> <span className="sep">{">"}</span>
            <span className="current">{collection.name}</span>
          </div>
        </div>
      </div>

      <div className="container products-page">
        <h1 className="products-page-title">{collection.name}</h1>

        {products.length === 0 ? (
          <p className="empty-state">Bu koleksiyonda henüz ürün yok.</p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
