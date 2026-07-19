"use client";

import { useRouter } from "next/navigation";
import { mutateJson } from "@/lib/client-api";

export default function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await mutateJson("/admin/auth/logout", "POST");
    router.push("/admin/giris");
    router.refresh();
  }

  return (
    <button className="btn btn-secondary" style={{ fontSize: "0.85rem" }} onClick={handleLogout}>
      Çıkış Yap
    </button>
  );
}
