"use client";

import { useState } from "react";

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export default function SupportFaqList({ entries }: { entries: FaqEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (entries.length === 0) return null;

  return (
    <div style={{ margin: "20px 0 32px" }}>
      {entries.map((entry) => {
        const open = openId === entry.id;
        return (
          <div key={entry.id} style={{ borderBottom: "1px solid var(--color-border)" }}>
            <button
              type="button"
              onClick={() => setOpenId(open ? null : entry.id)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "14px 4px",
                background: "none",
                border: "none",
                textAlign: "left",
                fontWeight: 600,
                fontSize: "0.92rem",
                cursor: "pointer",
                color: "var(--color-text)",
              }}
            >
              {entry.question}
              <i className={`fas fa-chevron-${open ? "up" : "down"}`} style={{ fontSize: 12, color: "var(--color-text-light)" }} />
            </button>
            {open && (
              <p style={{ margin: "0 4px 14px", fontSize: "0.85rem", color: "var(--color-text-light)", lineHeight: 1.7 }}>
                {entry.answer}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
