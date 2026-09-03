import EditProduct from "./edit-product";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ setup?: string; missing?: string }>;
}

export default async function EditProductPage({ params, searchParams }: Props) {
  const { id } = await params;
  const query = await searchParams;
  return (
    <div>
      <h2 style={{ fontSize: "1.05rem" }}>Ürünü Düzenle</h2>
      <EditProduct
        productId={Number(id)}
        setupIncomplete={query.setup === "incomplete"}
        setupMissing={query.missing}
      />
    </div>
  );
}
