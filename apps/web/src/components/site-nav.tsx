import Link from "next/link";
import { apiFetch } from "../lib/api";
import type { CustomerProfile } from "../lib/types";

async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

export default async function SiteNav() {
  const customer = await getCurrentCustomer();

  return (
    <header className="site-nav">
      <div className="container">
        <Link href="/" className="logo">
          Gülüm Şalım
        </Link>
        <nav>
          <Link href="/urunler">Ürünler</Link>
          <Link href="/sepet">Sepet</Link>
          {customer ? (
            <span>Merhaba, {customer.fullName.split(" ")[0]}</span>
          ) : (
            <>
              <Link href="/giris">Giriş</Link>
              <Link href="/kayit">Kayıt Ol</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
