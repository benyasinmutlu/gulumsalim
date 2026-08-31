import Link from "next/link";
import { getCategories, getCurrentCustomer, getProduct, getQuestions } from "@/components/product-detail-view";
import QuestionForm from "@/app/(site)/urun/[slug]/question-form";
import QuestionHelpfulButton from "@/components/question-helpful-button";

// Trendyol'daki gibi "N Soru ›" ürün sayfasından tıklanınca açılan ayrı bir
// sayfa - soru sorma politikası + tam soru listesi + soru formu burada.
// `product-detail-view.tsx`teki inline "Sorular" bloğu artık sadece ilk 3
// soruyu gösterip buraya link veriyor (bkz. kullanıcı isteği: "soru sorma
// yerini ayrı bir sayfa olarak ele alalım").
export default async function ProductQuestionsView({
  slug,
  expectedCategorySlug,
}: {
  slug: string;
  expectedCategorySlug?: string;
}): Promise<React.ReactElement | null> {
  const [product, questions, customer, categories] = await Promise.all([
    getProduct(slug),
    getQuestions(slug),
    getCurrentCustomer(),
    getCategories(),
  ]);
  if (!product) return null;

  const category = categories.find((c) => c.id === product.categoryId);
  if (expectedCategorySlug && category?.slug !== expectedCategorySlug) return null;

  const productHref = category ? `/${category.slug}/${product.slug}` : `/urun/${product.slug}`;

  return (
    <main className="main-content">
      <div className="breadcrumb-bar">
        <div className="container">
          <div className="breadcrumb">
            <Link href="/">Ana Sayfa</Link> <span className="sep">{">"}</span>
            <Link href={productHref}>{product.name}</Link> <span className="sep">{">"}</span>
            <span className="current">Sorular</span>
          </div>
        </div>
      </div>

      <section className="products-section">
        <div className="container" style={{ maxWidth: 760 }}>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {product.name} — Sorular {questions.length > 0 && `(${questions.length})`}
          </h1>
          <p style={{ fontSize: "0.9rem", color: "var(--color-text-light)", marginBottom: 24 }}>
            <Link href={productHref}>← Ürüne geri dön</Link>
          </p>

          <div
            style={{
              background: "var(--color-bg-alt)",
              border: "1px solid var(--color-border)",
              borderRadius: 12,
              padding: "16px 18px",
              marginBottom: 28,
              fontSize: "0.85rem",
              lineHeight: 1.7,
              color: "var(--color-text-light)",
            }}
          >
            <strong style={{ display: "block", marginBottom: 6, color: "var(--color-text)" }}>
              <i className="fas fa-circle-info" /> Soru Sorma Politikası
            </strong>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>Sorularınız yalnızca bu ürünle ilgili olmalıdır; sipariş/hesap sorularınız için Yardım &amp; Destek&apos;i kullanın.</li>
              <li>Telefon, IBAN, e-posta veya sosyal medya gibi iletişim bilgisi paylaşılamaz, bu tür sorular gönderilemez.</li>
              <li>Sorunuz satıcıya iletilir ve yanıtlandığında bu sayfada herkese açık olarak görünür.</li>
              <li>Hakaret, reklam veya uygunsuz içerik barındıran sorular yayınlanmadan kaldırılır.</li>
            </ul>
          </div>

          <div className="review-list">
            {questions.length === 0 ? (
              <p style={{ fontSize: "0.9rem" }}>Bu ürün hakkında henüz soru sorulmamış. İlk soruyu siz sorun!</p>
            ) : (
              questions.map((q) => (
                <div key={q.id} className="review-card">
                  <strong style={{ fontSize: 13 }}>{q.customerName}</strong>
                  <p>{q.question}</p>
                  {q.answer && (
                    <div className="review-vendor-reply">
                      <strong>
                        <i className="fas fa-store" /> Satıcı Yanıtı:
                      </strong>
                      <p>{q.answer}</p>
                      {customer && (
                        <QuestionHelpfulButton
                          slug={slug}
                          questionId={q.id}
                          initialCount={q.helpfulCount ?? 0}
                          initialVoted={q.hasVoted ?? false}
                        />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 24 }}>
            <QuestionForm slug={slug} loggedIn={!!customer} />
          </div>
        </div>
      </section>
    </main>
  );
}
