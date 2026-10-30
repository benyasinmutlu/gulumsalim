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
    <div className="support-faq-list">
      {entries.map((entry) => {
        const open = openId === entry.id;
        return (
          <div key={entry.id} className="support-faq-item">
            <button type="button" className="support-faq-question" onClick={() => setOpenId(open ? null : entry.id)}>
              {entry.question}
              <i className={`fas fa-chevron-${open ? "up" : "down"}`} />
            </button>
            {open && <p className="support-faq-answer">{entry.answer}</p>}
          </div>
        );
      })}
    </div>
  );
}
