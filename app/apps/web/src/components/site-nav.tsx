import { apiFetch } from "../lib/api";
import type { Category, CartResponse, CustomerProfile, SiteSettings } from "../lib/types";
import TopBar from "./top-bar";
import HeaderShell from "./header-shell";

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

async function getSiteBranding(): Promise<SiteSettings> {
  const res = await apiFetch("/site-settings");
  if (!res.ok) return {};
  return res.json();
}

export default async function SiteNav() {
  const [customer, categories, cartCount, branding] = await Promise.all([
    getCurrentCustomer(),
    getCategories(),
    getCartCount(),
    getSiteBranding(),
  ]);

  return (
    <>
      <TopBar customer={customer} />
      <HeaderShell
        categories={categories}
        customer={customer}
        cartCount={cartCount}
        siteName={branding.site_name}
        siteLogo={branding.site_logo}
      />
    </>
  );
}
