import { Suspense } from "react";
import MessagesClient from "./messages-client";

export default function CustomerMessagesPage() {
  return (
    <Suspense fallback={<div className="form-card">Yükleniyor...</div>}>
      <MessagesClient />
    </Suspense>
  );
}
