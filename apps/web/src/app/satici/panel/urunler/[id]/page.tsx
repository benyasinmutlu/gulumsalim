import EditProduct from "./edit-product";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: Props) {
  const { id } = await params;
  return (
    <div>
      <h2 style={{ fontSize: "1.05rem" }}>Ürünü Düzenle</h2>
      <EditProduct productId={Number(id)} />
    </div>
  );
}
