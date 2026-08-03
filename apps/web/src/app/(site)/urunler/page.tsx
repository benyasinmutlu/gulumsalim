import type { Metadata } from "next";
import ProductListing, { type ProductListingParams } from "@/components/product-listing";

interface Props {
  searchParams: Promise<ProductListingParams>;
}

// Ürün listesi filtreye göre aynı sabit başlığı gösteriyordu (arama, indirim,
// mağaza filtresi fark etmeksizin) - her varyant için ayrı, açıklayıcı bir
// <title>/description arama motorlarının doğru sayfayı indekslemesi için
// önemli (bkz. kullanıcı geri bildirimi: "ürünler listelenirken seo mantığı
// olmalı").
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const params = await searchParams;
  if (params.search) {
    return {
      title: `"${params.search}" için arama sonuçları | Gülüm Şalım`,
      description: `Gülüm Şalım'da "${params.search}" araması için en uygun kadın giyim ürünlerini keşfedin.`,
    };
  }
  if (params.saleOnly === "true") {
    return {
      title: "İndirimli Ürünler | Gülüm Şalım",
      description: "Gülüm Şalım'daki tüm indirimli kadın giyim ürünlerini kaçırmayın.",
    };
  }
  if (params.secondHand === "true") {
    return {
      title: "Dolap - 2. El Ürünler | Gülüm Şalım",
      description: "Gülüm Şalım Dolap'ta satıcıların 2. el ürünlerini keşfedin.",
    };
  }
  if (params.vendor) {
    return { title: `Mağaza Ürünleri | Gülüm Şalım` };
  }
  return {
    title: "Tüm Ürünler | Gülüm Şalım",
    description: "Gülüm Şalım'daki tüm kadın giyim ürünlerini keşfedin, filtreleyin ve sizin için en uygun parçaları bulun.",
  };
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  return <ProductListing params={params} />;
}
