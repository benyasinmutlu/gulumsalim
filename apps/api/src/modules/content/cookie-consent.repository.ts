import { db } from "../../db/client";
import { cookieConsents } from "../../db/schema/index";

export async function insertCookieConsent(data: {
  sessionId: string;
  customerId?: number;
  performance: boolean;
  functionality: boolean;
  advertising: boolean;
  ipAddress?: string;
  userAgent?: string;
}) {
  const [row] = await db.insert(cookieConsents).values(data).returning();
  if (!row) throw new Error("Çerez tercihi kaydedilemedi");
  return row;
}
