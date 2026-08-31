import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customerNotifications, productFavorites, vendorFollowers } from "../../db/schema/index";

// bkz. denetim raporu madde 17: "Favori ürün indirime girdiğinde/fiyat
// düştüğünde bildirim" - önceden productFavorites tablosu vardı ama hiçbir
// fiyat güncellemesi buna bakmıyordu. Ateşle-unut (route'un yanıt süresini
// etkilemesin diye await edilmez, bkz. vendor-products.routes.ts) - tek bir
// toplu INSERT, favorileyen sayısı kadar ayrı sorgu değil.
export async function notifyFavoritersOfPriceDrop(productId: number, productName: string, productSlug: string): Promise<void> {
  const favoriters = await db
    .select({ customerId: productFavorites.customerId })
    .from(productFavorites)
    .where(eq(productFavorites.productId, productId));
  if (favoriters.length === 0) return;
  await db.insert(customerNotifications).values(
    favoriters.map((f) => ({
      customerId: f.customerId,
      type: "price_drop",
      title: "Favorindeki üründe fiyat düştü",
      message: `"${productName}" için fiyat düştü, kaçırma!`,
      link: `/urun/${productSlug}`,
    })),
  );
}

// bkz. denetim raporu madde 17: "Takip edilen mağaza yeni ürün eklediğinde
// bildirim" - vendorFollowers tablosu vardı ama ürün eklenince hiç
// kullanılmıyordu.
export async function notifyFollowersOfNewProduct(vendorId: number, vendorStoreName: string, productName: string, productSlug: string): Promise<void> {
  const followers = await db
    .select({ customerId: vendorFollowers.customerId })
    .from(vendorFollowers)
    .where(eq(vendorFollowers.vendorId, vendorId));
  if (followers.length === 0) return;
  await db.insert(customerNotifications).values(
    followers.map((f) => ({
      customerId: f.customerId,
      type: "new_product_from_followed_vendor",
      title: `${vendorStoreName} yeni bir ürün ekledi`,
      message: productName,
      link: `/urun/${productSlug}`,
    })),
  );
}
