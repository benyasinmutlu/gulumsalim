import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { newsletterSubscribers } from "../../db/schema/index";

// Aynı e-postanın tekrar kaydı sessizce mevcut satırı döner - ziyaretçi
// formu iki kez göndürdüğünde (çift tık, sekme yenileme) bir hata yerine
// aynı "kaydoldun" hissini görsün diye (bkz. UNIQUE(email) çakışması).
export async function insertNewsletterSubscriber(email: string) {
  const [existing] = await db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)).limit(1);
  if (existing) return existing;
  const [row] = await db.insert(newsletterSubscribers).values({ email }).returning();
  return row!;
}
