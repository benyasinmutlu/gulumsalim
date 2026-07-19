"use client";

import { useRouter } from "next/navigation";
import { mutateJson } from "@/lib/client-api";

export default function VendorLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await mutateJson("/vendor/auth/logout", "POST");
    router.push("/satici/giris");
    router.refresh();
  }

  return (
    <button className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={handleLogout}>
      Çıkış Yap
    </button>
  );
}
