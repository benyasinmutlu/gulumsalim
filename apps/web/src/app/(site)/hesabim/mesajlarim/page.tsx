import { Suspense } from "react";
import type { Metadata } from "next";
import MessagesClient from "./messages-client";

export const metadata: Metadata = { title: "Mesajlarım | Gülüm Şalım" };

export default function CustomerMessagesPage() {
  return (
    <Suspense fallback={<div className="form-card">Yükleniyor...</div>}>
      <MessagesClient />
    </Suspense>
  );
}
