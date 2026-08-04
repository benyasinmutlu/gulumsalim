import { apiFetch } from "../lib/api";
import type { Category, CartResponse, CustomerProfile } from "../lib/types";
import MobileBottomNavClient from "./mobile-bottom-nav-client";

async function getCurrentCustomer(): Promise<CustomerProfile | null> {
  const res = await apiFetch("/auth/me");
  if (!res.ok) return null;
  return res.json();
}

async function getCategories(): Promise<Category[]> {
  const res = await apiFetch("/categories");
  if (!res.ok) return [];
  return res.json();
}

async function getCartCount(): Promise<number> {
  const res = await apiFetch("/cart");
  if (!res.ok) return 0;
  const cart: CartResponse = await res.json();
  return cart.items.reduce((sum, item) => sum + item.quantity, 0);
}

async function getFavoriteCount(hasCustomer: boolean): Promise<number> {
  if (!hasCustomer) return 0;
  const res = await apiFetch("/favorites");
  if (!res.ok) return 0;
  const rows: unknown[] = await res.json();
  return rows.length;
}

// bkz. onaylı plan Faz 7: mobilde sabit alt tab-bar (Ana Sayfa/Kategoriler/
// Sepetim/Favorilerim/Hesabım) - Trendyol/Hepsiburada gibi pazar yeri
// uygulamalarının mobil alışkanlığına uyar. Masaüstünde hiç render edilmez
// (bkz. globals.css .mobile-bottom-nav media query - sadece <768px görünür).
export default async function MobileBottomNav() {
  const customer = await getCurrentCustomer();
  const [categories, cartCount, favoriteCount] = await Promise.all([
    getCategories(),
    getCartCount(),
    getFavoriteCount(Boolean(customer)),
  ]);

  return (
    <MobileBottomNavClient
      categories={categories}
      cartCount={cartCount}
      favoriteCount={favoriteCount}
      loggedIn={Boolean(customer)}
    />
  );
}
