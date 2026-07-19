"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutateJson } from "@/lib/client-api";
import type { CartResponse } from "@/lib/types";

export default function AddToCartButton({ productId }: { productId: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    try {
      await mutateJson<CartResponse>("/cart/items", "POST", { productId, quantity: 1 });
      setMessage("Sepete eklendi.");
      router.refresh();
    } catch {
      setMessage("Sepete eklenemedi, tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: "1.25rem" }}>
      <button className="btn" onClick={handleClick} disabled={loading}>
        {loading ? "Ekleniyor..." : "Sepete Ekle"}
      </button>
      {message && <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{message}</p>}
    </div>
  );
}
