import type { Metadata } from "next";
import Link from "next/link";
import { apiFetchJson } from "@/lib/api";
import SupportChat from "@/components/support-chat";
import SupportFaqList, { type FaqEntry } from "@/components/support-faq-list";

export const metadata: Metadata = {
  title: "Yardım & Destek | Gülüm Şalım",
  description: "Sık sorulan sorular ve canlı destek asistanı.",
};

async function getFaq(): Promise<FaqEntry[]> {
  try {
    return await apiFetchJson<FaqEntry[]>("/support/faq");
  } catch {
    return [];
  }
}

export default async function HelpPage() {
  const faq = await getFaq();

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">Yardım &amp; Destek</span>
          </div>
        </div>
      </div>

      <section className="products-section">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="section-header" style={{ textAlign: "left", marginBottom: 8 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>
              Yardım &amp; Destek
            </h1>
            <p style={{ color: "var(--color-text-light)", fontSize: "0.9rem" }}>
              Sık sorulan sorulara göz atın ya da destek asistanımıza yazın.
            </p>
          </div>

          <SupportFaqList entries={faq} />
          <SupportChat />
        </div>
      </section>
    </main>
  );
}
