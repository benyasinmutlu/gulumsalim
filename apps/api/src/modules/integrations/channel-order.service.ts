import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { channelListings, channelWebhookEvents, productVariants, products } from "../../db/schema/index";
import { enqueueStockSyncTx, enqueueVariantStockSyncTx } from "./inventory-sync.service";
import type { SalesChannel } from "./inventory-sync";

export interface ChannelOrderLine {
  barcode: string;
  quantity: number;
}

export async function processChannelOrderOnce(input: {
  channel: SalesChannel;
  eventKey: string;
  payloadHash: string;
  lines: ChannelOrderLine[];
}): Promise<{ processed: number; duplicate: boolean }> {
  return db.transaction(async (tx) => {
    const [event] = await tx
      .insert(channelWebhookEvents)
      .values({ channel: input.channel, eventKey: input.eventKey, payloadHash: input.payloadHash })
      .onConflictDoNothing({ target: [channelWebhookEvents.channel, channelWebhookEvents.eventKey] })
      .returning({ id: channelWebhookEvents.id });
    if (!event) return { processed: 0, duplicate: true };

    let processed = 0;
    for (const line of input.lines) {
      if (!line.barcode || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
      const [listing] = await tx
        .select({
          productId: channelListings.productId,
          variantId: channelListings.variantId,
        })
        .from(channelListings)
        .where(
          and(
            eq(channelListings.channel, input.channel),
            eq(channelListings.externalBarcode, line.barcode),
            eq(channelListings.enabled, true),
          ),
        )
        .limit(1);
      if (!listing) continue;

      if (listing.variantId) {
        const [updated] = await tx
          .update(productVariants)
          .set({ stock: sql`${productVariants.stock} - ${line.quantity}` })
          .where(
            and(
              eq(productVariants.id, listing.variantId),
              eq(productVariants.productId, listing.productId),
              gte(productVariants.stock, line.quantity),
            ),
          )
          .returning({ stock: productVariants.stock });
        if (!updated) continue;
        await enqueueVariantStockSyncTx(tx, listing.variantId, updated.stock, input.channel);
      } else {
        const [updated] = await tx
          .update(products)
          .set({ stock: sql`${products.stock} - ${line.quantity}`, updatedAt: new Date() })
          .where(and(eq(products.id, listing.productId), gte(products.stock, line.quantity)))
          .returning({ stock: products.stock });
        if (!updated) continue;
        await enqueueStockSyncTx(tx, listing.productId, updated.stock, input.channel);
      }
      processed += 1;
    }

    await tx.update(channelWebhookEvents).set({ processedLines: processed }).where(eq(channelWebhookEvents.id, event.id));
    return { processed, duplicate: false };
  });
}
