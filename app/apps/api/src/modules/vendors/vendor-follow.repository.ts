import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { products, vendorFollowers, vendors } from "../../db/schema/index";
import { sql } from "drizzle-orm";
import { outer } from "../../lib/sql-helpers";

// gulumsalim.com'daki follow.php'nin karşılığı - "aç/kapat" (favori
// toggle'ıyla aynı desen): önce insert denenir, satır zaten varsa silinir.
export async function toggleVendorFollow(customerId: number, vendorId: number): Promise<boolean> {
  const inserted = await db
    .insert(vendorFollowers)
    .values({ customerId, vendorId })
    .onConflictDoNothing({ target: [vendorFollowers.customerId, vendorFollowers.vendorId] })
    .returning();
  if (inserted.length > 0) return true;

  await db
    .delete(vendorFollowers)
    .where(and(eq(vendorFollowers.customerId, customerId), eq(vendorFollowers.vendorId, vendorId)));
  return false;
}

export async function isFollowingVendor(customerId: number, vendorId: number): Promise<boolean> {
  const [row] = await db
    .select({ vendorId: vendorFollowers.vendorId })
    .from(vendorFollowers)
    .where(and(eq(vendorFollowers.customerId, customerId), eq(vendorFollowers.vendorId, vendorId)))
    .limit(1);
  return row !== undefined;
}

export async function listFollowedVendors(customerId: number) {
  return db
    .select({
      id: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      logo: vendors.logo,
      productCount: sql<number>`(SELECT COUNT(*) FROM ${products} WHERE ${products.vendorId} = ${outer(vendors.id)} AND ${products.status} = 'active')`.mapWith(
        Number,
      ),
    })
    .from(vendorFollowers)
    .innerJoin(vendors, eq(vendorFollowers.vendorId, vendors.id))
    .where(and(eq(vendorFollowers.customerId, customerId), eq(vendors.status, "active")));
}
