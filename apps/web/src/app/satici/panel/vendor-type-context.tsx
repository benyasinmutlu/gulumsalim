"use client";

import { createContext, useContext } from "react";
import type { VendorProfile } from "@/lib/types";

const VendorTypeContext = createContext<VendorProfile["vendorType"]>(undefined);

export function VendorTypeProvider({
  vendorType,
  children,
}: {
  vendorType: VendorProfile["vendorType"];
  children: React.ReactNode;
}) {
  return <VendorTypeContext.Provider value={vendorType}>{children}</VendorTypeContext.Provider>;
}

// bkz. kullanıcı isteği: "bireysel satıcıları satıcı panelinin ... yerleri
// daha basit ve kullanımı kolay olsun" - panel ağacındaki herhangi bir yer
// (sidebar, ürün formu) her seferinde /vendor/auth/me'yi tekrar çekmeden
// bireysel mi işletme mi olduğunu buradan öğrenir (bkz. layout.tsx).
// vendorType eksikse (eski kayıtlar) işletme gibi davranılır - mevcut
// satıcıların panelinde hiçbir şey sessizce kaybolmaz.
export function useIsIndividualVendor(): boolean {
  return useContext(VendorTypeContext) === "individual";
}
