"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Category } from "../lib/types";

const CategoryNavContext = createContext<{
  override: Category[] | null;
  setOverride: (categories: Category[] | null) => void;
} | null>(null);

export function CategoryNavProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<Category[] | null>(null);
  return <CategoryNavContext.Provider value={{ override, setOverride }}>{children}</CategoryNavContext.Provider>;
}

export function useCategoryNavOverride() {
  const ctx = useContext(CategoryNavContext);
  if (!ctx) throw new Error("useCategoryNavOverride must be used within CategoryNavProvider");
  return ctx;
}

// "Tümünü Gör" / listeleme sayfalarında (bkz. kullanıcı isteği: "Tümünü Gör
// dediğimde headerın kategorileri gözükmeyecek sadece listelenen ürünlerden
// hangi kategoriler listeniyorsa onlar olacak") header'daki kategori
// menüsünü, o sayfadaki sonuç kümesinde fiilen geçen kategorilerle
// sınırlamak için - sayfadan ayrılınca (unmount) tam listeye geri döner.
export function CategoryNavSync({ categories }: { categories: Category[] }) {
  const { setOverride } = useCategoryNavOverride();
  const key = categories.map((c) => c.id).join(",");

  useEffect(() => {
    setOverride(categories);
    return () => setOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
