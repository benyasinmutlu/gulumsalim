import { redirect } from "next/navigation";
import { apiFetchJson } from "@/lib/api";
import type { CartResponse, CustomerProfile } from "@/lib/types";
import CheckoutForm from "./checkout-form";

async function getCustomer(): Promise<CustomerProfile | null> {
  try {
    return await apiFetchJson<CustomerProfile>("/auth/me");
  } catch {
    return null;
  }
}

export default async function CheckoutPage() {
  const customer = await getCustomer();
  if (!customer) redirect("/giris");

  const cart = await apiFetchJson<CartResponse>("/cart");
  if (cart.items.length === 0) redirect("/sepet");

  return (
    <main className="container" style={{ paddingBlock: "2.5rem" }}>
      <h1 style={{ fontSize: "1.3rem", marginBottom: "1.5rem" }}>Teslimat Bilgileri</h1>
      <p style={{ marginBottom: "1.5rem" }} className="price">
        Ödenecek Tutar: {Number(cart.subtotal).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺ + kargo
      </p>
      <CheckoutForm />
    </main>
  );
}
