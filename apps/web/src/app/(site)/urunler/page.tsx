import ProductListing, { type ProductListingParams } from "@/components/product-listing";

interface Props {
  searchParams: Promise<ProductListingParams>;
}

export default async function ProductsPage({ searchParams }: Props) {
  const params = await searchParams;
  return <ProductListing params={params} />;
}
