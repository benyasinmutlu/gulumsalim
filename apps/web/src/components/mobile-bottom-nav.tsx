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

// bkz. kullanıcı isteği (2026-10-30): "favorilerimi bence buradan kaldıralım
// zaten hesabımda var" - alt tab-bar artık Ana Sayfa/Kategoriler/Sepetim/
// Hesabım (Favorilerim, Hesabım > Favorilerim altında zaten erişilebilir).
// Masaüstünde hiç render edilmez (bkz. globals.css .mobile-bottom-nav
// media query - sadece <768px görünür).
export default async function MobileBottomNav() {
  const customer = await getCurrentCustomer();
  const [categories, cartCount] = await Promise.all([getCategories(), getCartCount()]);

  return <MobileBottomNavClient categories={categories} cartCount={cartCount} loggedIn={Boolean(customer)} />;
}
