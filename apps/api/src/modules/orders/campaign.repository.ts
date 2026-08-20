import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { db } from "../../db/client";
import { campaigns, categories, products, vendors } from "../../db/schema/index";
import type { Campaign, CampaignScope } from "./campaign.service";

function toCampaign(row: typeof campaigns.$inferSelect): Campaign {
  return {
    id: row.id,
    type: row.type,
    scope: row.scope,
    scopeId: row.scopeId,
    value: Number(row.value),
    minOrderAmount: row.minOrderAmount == null ? null : Number(row.minOrderAmount),
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    isActive: row.isActive,
  };
}

export async function listActiveCampaigns(): Promise<Campaign[]> {
  const rows = await db.select().from(campaigns).where(eq(campaigns.isActive, true));
  return rows.map(toCampaign);
}

export async function listLiveCampaignRows() {
  const now = new Date();
  return db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      type: campaigns.type,
      scope: campaigns.scope,
      scopeId: campaigns.scopeId,
      value: campaigns.value,
      minOrderAmount: campaigns.minOrderAmount,
      startsAt: campaigns.startsAt,
      endsAt: campaigns.endsAt,
      categorySlug: categories.slug,
      vendorSlug: vendors.storeSlug,
    })
    .from(campaigns)
    .leftJoin(categories, eq(campaigns.scopeId, categories.id))
    .leftJoin(vendors, eq(campaigns.scopeId, vendors.id))
    .where(and(
      eq(campaigns.isActive, true),
      or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
      or(isNull(campaigns.endsAt), gte(campaigns.endsAt, now)),
    ))
    .orderBy(desc(campaigns.createdAt));
}

export async function listCampaignVendors() {
  const now = new Date();
  return db
    .select({
      vendorId: vendors.id,
      storeName: vendors.storeName,
      storeSlug: vendors.storeSlug,
      logo: vendors.logo,
      type: campaigns.type,
      value: campaigns.value,
      campaignName: campaigns.name,
    })
    .from(campaigns)
    .innerJoin(vendors, eq(vendors.id, campaigns.scopeId))
    .where(and(
      eq(campaigns.scope, "vendor"),
      eq(campaigns.isActive, true),
      or(isNull(campaigns.startsAt), lte(campaigns.startsAt, now)),
      or(isNull(campaigns.endsAt), gte(campaigns.endsAt, now)),
      eq(vendors.status, "active"),
    ))
    .orderBy(desc(campaigns.value));
}

export async function listCampaigns() {
  return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
}

export async function findCampaignById(id: number) {
  const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  return row ?? null;
}

export async function campaignTargetExists(scope: CampaignScope, scopeId: number | null): Promise<boolean> {
  if (scope === "all") return scopeId === null;
  if (scopeId === null) return false;

  const table = scope === "category" ? categories : scope === "vendor" ? vendors : products;
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.id, scopeId)).limit(1);
  return Boolean(row);
}

export async function createCampaign(data: typeof campaigns.$inferInsert) {
  const [row] = await db.insert(campaigns).values(data).returning();
  return row!;
}

export async function updateCampaign(id: number, data: Partial<typeof campaigns.$inferInsert>) {
  const [row] = await db.update(campaigns).set(data).where(eq(campaigns.id, id)).returning();
  return row ?? null;
}

export async function deleteCampaignIfUnused(id: number): Promise<"deleted" | "in_use" | "not_found"> {
  try {
    const rows = await db.delete(campaigns).where(eq(campaigns.id, id)).returning({ id: campaigns.id });
    return rows.length ? "deleted" : "not_found";
  } catch (error) {
    if ((error as { code?: string })?.code === "23503") return "in_use";
    throw error;
  }
}
