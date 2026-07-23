"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackPromoBannerClick } from "@/lib/client-api";

interface Props {
  bannerId: number;
  href: string;
  className?: string;
  children: ReactNode;
}

// admin/promo-banners.php'deki tıklama takibinin karşılığı - Link'in
// kendisi server component ağacından geliyor, onClick eklemek için ayrı
// bir client component sarmalayıcı gerekir.
export default function PromoBannerLink({ bannerId, href, className, children }: Props) {
  return (
    <Link href={href} className={className} onClick={() => trackPromoBannerClick(bannerId)}>
      {children}
    </Link>
  );
}
