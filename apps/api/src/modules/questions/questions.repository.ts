import { and, count, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, productQuestionVotes, productQuestions, products, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";
import { createNotification } from "../notifications/notifications.repository";

const helpfulCountExpr = sql<number>`(SELECT COUNT(*) FROM ${productQuestionVotes} WHERE ${productQuestionVotes.questionId} = ${outer(productQuestions.id)})`.mapWith(
  Number,
);

export async function insertQuestion(productId: number, customerId: number, question: string) {
  const [row] = await db.insert(productQuestions).values({ productId, customerId, question }).returning();
  if (!row) throw new Error("Soru kaydedilemedi");

  const [product] = await db.select({ vendorId: products.vendorId, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
  if (product) {
    await createNotification(product.vendorId, "new_question", "Yeni Ürün Sorusu", `"${product.name}" için yeni bir soru var.`, "/satici/panel/sorular");
  }

  return row;
}

// Herkese açık listede sadece cevaplanmış sorular gösterilir - henüz
// cevaplanmamış bir soru satıcı panelinde bekler.
// bkz. denetim raporu madde 18: en faydalı bulunan cevaplar önce gösterilir
// (eşitlikte en yeni önce). `viewerCustomerId` verilirse (giriş yapmış
// müşteri) her sorunun "ben oy verdim mi" durumu da döner.
export async function listAnsweredQuestions(productId: number, viewerCustomerId?: number) {
  const rows = await db
    .select({
      id: productQuestions.id,
      question: productQuestions.question,
      answer: productQuestions.answer,
      createdAt: productQuestions.createdAt,
      customerName: customers.fullName,
      helpfulCount: helpfulCountExpr,
    })
    .from(productQuestions)
    .innerJoin(customers, eq(productQuestions.customerId, customers.id))
    .where(and(eq(productQuestions.productId, productId), isNotNull(productQuestions.answer)))
    .orderBy(desc(helpfulCountExpr), desc(productQuestions.createdAt));

  if (!viewerCustomerId || rows.length === 0) return rows.map((r) => ({ ...r, hasVoted: false }));

  const votedRows = await db
    .select({ questionId: productQuestionVotes.questionId })
    .from(productQuestionVotes)
    .where(and(eq(productQuestionVotes.customerId, viewerCustomerId), inArray(productQuestionVotes.questionId, rows.map((r) => r.id))));
  const votedIds = new Set(votedRows.map((r) => r.questionId));
  return rows.map((r) => ({ ...r, hasVoted: votedIds.has(r.id) }));
}

// Oy verme uç noktası bu soru gerçekten bu ürüne mi ait diye kontrol eder -
// başka bir ürünün soru id'siyle oy atlatılamasın diye.
export async function findQuestionForProduct(productId: number, questionId: number) {
  const [row] = await db
    .select({ id: productQuestions.id })
    .from(productQuestions)
    .where(and(eq(productQuestions.id, questionId), eq(productQuestions.productId, productId)))
    .limit(1);
  return row ?? null;
}

// bkz. denetim raporu madde 18 - toggle: müşteri zaten oy vermişse geri
// çeker (unique index çift oyu zaten engeller, ama tekrar tıklama "kaldır"
// anlamına gelmeli). Sorunun cevaplanmış olması zorunlu değil (kontrol
// route katmanında productId eşleşmesiyle yapılır).
export async function toggleQuestionHelpful(questionId: number, customerId: number): Promise<boolean> {
  const [existing] = await db
    .select({ questionId: productQuestionVotes.questionId })
    .from(productQuestionVotes)
    .where(and(eq(productQuestionVotes.questionId, questionId), eq(productQuestionVotes.customerId, customerId)))
    .limit(1);
  if (existing) {
    await db
      .delete(productQuestionVotes)
      .where(and(eq(productQuestionVotes.questionId, questionId), eq(productQuestionVotes.customerId, customerId)));
    return false;
  }
  await db.insert(productQuestionVotes).values({ questionId, customerId });
  return true;
}

// gulumsalim.com'daki hesabım/sorularım sayfasının karşılığı - müşterinin
// sorduğu tüm sorular, cevaplanmış olsun ya da olmasın.
export async function listQuestionsByCustomer(customerId: number) {
  return db
    .select({
      id: productQuestions.id,
      productId: productQuestions.productId,
      productName: products.name,
      productSlug: products.slug,
      question: productQuestions.question,
      answer: productQuestions.answer,
      createdAt: productQuestions.createdAt,
    })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .where(eq(productQuestions.customerId, customerId))
    .orderBy(desc(productQuestions.createdAt));
}

export async function listVendorQuestions(vendorId: number) {
  return db
    .select({
      id: productQuestions.id,
      productId: productQuestions.productId,
      productName: products.name,
      question: productQuestions.question,
      answer: productQuestions.answer,
      createdAt: productQuestions.createdAt,
      customerName: customers.fullName,
    })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .innerJoin(customers, eq(productQuestions.customerId, customers.id))
    .where(eq(products.vendorId, vendorId))
    .orderBy(desc(productQuestions.createdAt));
}

export async function findQuestionOwnedByVendor(vendorId: number, questionId: number) {
  const [row] = await db
    .select({ id: productQuestions.id })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .where(and(eq(productQuestions.id, questionId), eq(products.vendorId, vendorId)))
    .limit(1);
  return row ?? null;
}

export async function answerQuestion(questionId: number, answer: string) {
  const [row] = await db
    .update(productQuestions)
    .set({ answer })
    .where(eq(productQuestions.id, questionId))
    .returning({ id: productQuestions.id });
  return row ?? null;
}

// admin/reviews.php'nin "Sorular" sekmesinin karşılığı - admin sorulara
// cevap vermez (bu satıcının işi), sadece uygunsuz olanları kaldırabilir.
export async function listAllQuestionsForAdmin(filter?: "pending" | "answered") {
  const base = db
    .select({
      id: productQuestions.id,
      productId: productQuestions.productId,
      productName: products.name,
      productSlug: products.slug,
      vendorStoreName: vendors.storeName,
      question: productQuestions.question,
      answer: productQuestions.answer,
      createdAt: productQuestions.createdAt,
      customerName: customers.fullName,
    })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .innerJoin(vendors, eq(products.vendorId, vendors.id))
    .innerJoin(customers, eq(productQuestions.customerId, customers.id))
    .orderBy(desc(productQuestions.createdAt));

  if (filter === "pending") return base.where(isNull(productQuestions.answer));
  if (filter === "answered") return base.where(isNotNull(productQuestions.answer));
  return base;
}

// Ürün detay sayfasında "satıcıya sorulan toplam soru" göstergesi için -
// getVendorReviewSummary (vendor-reviews.repository.ts) ile aynı desen.
export async function getVendorQuestionCount(vendorId: number): Promise<number> {
  const [row] = await db
    .select({ total: count(productQuestions.id) })
    .from(productQuestions)
    .innerJoin(products, eq(productQuestions.productId, products.id))
    .where(and(eq(products.vendorId, vendorId), isNotNull(productQuestions.answer)));
  return row?.total ?? 0;
}

export async function deleteQuestion(id: number) {
  const [row] = await db.delete(productQuestions).where(eq(productQuestions.id, id)).returning({ id: productQuestions.id });
  return row ?? null;
}
