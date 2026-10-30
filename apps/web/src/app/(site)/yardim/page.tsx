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
        <div className="container-hero">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span> <span className="current">Yardım &amp; Destek</span>
          </div>
        </div>
      </div>

      {/* bkz. hesabım karşılama bandı dilinden farklı bir kompozisyon:
          burada SSS akordeonu ve destek asistanı yan yana iki kolon -
          sayfanın işlevi "gözat" değil "cevap bul/sor". */}
      <section className="page-intro">
        <div className="container-hero">
          <span className="hero-tag">Destek</span>
          <h1 className="page-intro-title">Yardım &amp; Destek</h1>
          <p className="page-intro-sub">Sık sorulan sorulara göz atın ya da destek asistanımıza yazın.</p>
        </div>
      </section>

      <section className="support-section">
        <div className="container-hero">
          <div className="support-layout">
            <SupportFaqList entries={faq} />
            <SupportChat />
          </div>
        </div>
      </section>
    </main>
  );
}
