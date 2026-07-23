import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "../../db/client";
import { customers, productQuestions, products, vendors } from "../../db/schema/index";
import { createNotification } from "../notifications/notifications.repository";

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
export async function listAnsweredQuestions(productId: number) {
  return db
    .select({
      id: productQuestions.id,
      question: productQuestions.question,
      answer: productQuestions.answer,
      createdAt: productQuestions.createdAt,
      customerName: customers.fullName,
    })
    .from(productQuestions)
    .innerJoin(customers, eq(productQuestions.customerId, customers.id))
    .where(and(eq(productQuestions.productId, productId), isNotNull(productQuestions.answer)))
    .orderBy(desc(productQuestions.createdAt));
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

export async function deleteQuestion(id: number) {
  const [row] = await db.delete(productQuestions).where(eq(productQuestions.id, id)).returning({ id: productQuestions.id });
  return row ?? null;
}
