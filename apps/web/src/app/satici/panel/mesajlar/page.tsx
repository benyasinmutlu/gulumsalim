"use client";

import { useState } from "react";
import MessagesThread from "./messages-thread";
import CustomerMessages from "./customer-messages";

export default function VendorMessagesPage() {
  const [tab, setTab] = useState<"customers" | "admin">("customers");

  return (
    <div>
      <div className="tab-nav">
        <button className={`tab-btn ${tab === "customers" ? "active" : ""}`} onClick={() => setTab("customers")}>
          <i className="fas fa-users" /> Müşteri Mesajları
        </button>
        <button className={`tab-btn ${tab === "admin" ? "active" : ""}`} onClick={() => setTab("admin")}>
          <i className="fas fa-user-shield" /> Yönetimle Mesajlaşma
        </button>
      </div>
      {tab === "customers" ? <CustomerMessages /> : <MessagesThread />}
    </div>
  );
}
