"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { pingPresence } from "@/lib/client-api";

const HEARTBEAT_MS = 25_000;

// bkz. kullanıcı isteği: "admin panelden anlık sitede kaç kişi var
// görebilmeliyim ... hangi üründe kaç kişi var" - kök layout'a monte edilir,
// her ziyaretçiden (misafir dahil) periyodik bir "buradayım" sinyali gider.
// bkz. kullanıcı düzeltmesi: "admin paneldekiyle satıcı panelde ne kadar
// kaldığı vs gösterme" - personelin kendi panelinde gezinmesi ne "şu an
// sitede" sayacına ne de "hangi sayfada" listesine karışmasın.
export default function PresenceHeartbeat() {
  const pathname = usePathname();
  const isStaffPanel = pathname.startsWith("/admin") || pathname.startsWith("/satici");

  useEffect(() => {
    if (isStaffPanel) return;
    pingPresence(pathname);
    const interval = setInterval(() => pingPresence(pathname), HEARTBEAT_MS);
    return () => clearInterval(interval);
  }, [pathname, isStaffPanel]);

  return null;
}
