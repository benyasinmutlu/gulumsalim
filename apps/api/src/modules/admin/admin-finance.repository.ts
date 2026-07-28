import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { productReviews, productVariants, products, vendorEarnings, vendorPayouts, vendors } from "../../db/schema/index";
import { outer } from "../../lib/sql-helpers";

// admin/finance.php'nin karşılığı - vendor-finance.repository.ts'deki
// TEK satıcı özetinin (bkz. getVendorFinanceSummary) admin için TÜM
// satıcılar üzerinden toplanmış ve satıcı bazında kırılmış hali.
export async function getPlatformFinanceStats() {
  const [[earnings], [pendingPayouts], [paidPayouts], [walletTotal]] = await Promise.all([
    db.select({
      totalGross: sql<string>`COALESCE(SUM(${vendorEarnings.grossAmount}), 0)`,
      totalNet: sql<string>`COALESCE(SUM(${vendorEarnings.netAmount}), 0)`,
      totalCommission: sql<string>`COALESCE(SUM(${vendorEarnings.commissionAmount}), 0)`,
    }).from(vendorEarnings),
    db.select({ total: sql<string>`COALESCE(SUM(${vendorPayouts.amount}), 0)` }).from(vendorPayouts).where(eq(vendorPayouts.status, "pending")),
    db.select({ total: sql<string>`COALESCE(SUM(${vendorPayouts.amount}), 0)` }).from(vendorPayouts).where(eq(vendorPayouts.status, "paid")),
    db.select({ total: sql<string>`COALESCE(SUM(${vendors.walletBalance}), 0)` }).from(vendors),
  ]);

  return {
    platformGrossRevenue: earnings?.totalGross ?? "0",
    platformCommissionRevenue: earnings?.totalCommission ?? "0",
    vendorNetEarnings: earnings?.totalNet ?? "0",
    pendingPayoutTotal: pendingPayouts?.total ?? "0",
    paidPayoutTotal: paidPayouts?.total ?? "0",
    vendorBalanceTotal: walletTotal?.total ?? "0",
  };
}

// Satıcı bazında ciro/kazanç/bakiye özet tablosu - finance.php'nin ana
// tablosu, önceki denetimde hiç taşınmadığı tespit edilen kısım.
export async function listVendorFinanceSummaries() {
  return db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      logo: vendors.logo,
      bankIban: vendors.bankIban,
      walletBalance: vendors.walletBalance,
      grossRevenue: sql<string>`COALESCE((SELECT SUM(${vendorEarnings.grossAmount}) FROM ${vendorEarnings} WHERE ${vendorEarnings.vendorId} = ${outer(vendors.id)}), 0)`,
      netEarnings: sql<string>`COALESCE((SELECT SUM(${vendorEarnings.netAmount}) FROM ${vendorEarnings} WHERE ${vendorEarnings.vendorId} = ${outer(vendors.id)}), 0)`,
      totalPaid: sql<string>`COALESCE((SELECT SUM(${vendorPayouts.amount}) FROM ${vendorPayouts} WHERE ${vendorPayouts.vendorId} = ${outer(vendors.id)} AND ${vendorPayouts.status} = 'paid'), 0)`,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'active')`.mapWith(Number),
      avgRating: sql<string | null>`(SELECT AVG(${productReviews.rating}) FROM ${productReviews} INNER JOIN ${products} ON ${outer(products.id)} = ${productReviews.productId} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${productReviews.status} = 'approved')`,
      lowStockCount: sql<number>`(SELECT COUNT(*) FROM (SELECT p2.id FROM ${products} p2 INNER JOIN ${productVariants} pv ON pv.product_id = p2.id WHERE p2.vendor_id = ${outer(vendors.id)} AND p2.status = 'active' GROUP BY p2.id HAVING SUM(pv.stock) <= 5) low_stock_sub)`.mapWith(Number),
    })
    .from(vendors)
    .where(eq(vendors.status, "active"))
    .orderBy(desc(sql`(SELECT COALESCE(SUM(${vendorEarnings.grossAmount}), 0) FROM ${vendorEarnings} WHERE ${vendorEarnings.vendorId} = ${outer(vendors.id)})`));
}

export async function listProcessedPayouts() {
  return db
    .select({
      id: vendorPayouts.id,
      vendorId: vendorPayouts.vendorId,
      vendorStoreName: vendors.storeName,
      amount: vendorPayouts.amount,
      iban: vendorPayouts.iban,
      status: vendorPayouts.status,
      requestedAt: vendorPayouts.requestedAt,
      processedAt: vendorPayouts.processedAt,
      rejectionReason: vendorPayouts.rejectionReason,
    })
    .from(vendorPayouts)
    .innerJoin(vendors, eq(vendorPayouts.vendorId, vendors.id))
    .where(sql`${vendorPayouts.status} != 'pending'`)
    .orderBy(desc(vendorPayouts.processedAt))
    .limit(50);
}
