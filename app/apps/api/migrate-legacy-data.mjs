// Tek seferlik göç script'i: eski gulumsalim.com (MySQL, HTTPS export endpoint
// üzerinden) verisini yeni Postgres'e aktarır. Idempotent: tekrar çalıştırılırsa
// ON CONFLICT ile mevcut kayıtları günceller/atlar, çift kayıt oluşturmaz.
import pg from "pg";

const OLD_BASE = "https://gulumsalim.com/_ms_export_x7f2.php";
const OLD_TOKEN = process.env.MIGRATE_TOKEN;
if (!OLD_TOKEN) throw new Error("MIGRATE_TOKEN env değişkeni gerekli");

async function fetchOld(table) {
  const url = `${OLD_BASE}?token=${OLD_TOKEN}&action=dump&table=${table}&limit=5000&offset=0`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${table} çekilemedi: ${res.status}`);
  return res.json();
}

function basename(p) {
  return p ? p.split("/").pop() : null;
}

function toMigratedUrl(oldPath) {
  const b = basename(oldPath);
  return b ? `/uploads/migrated/${b}` : null;
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const [oldCategories, oldVendors, oldCustomers, oldProducts, oldVariants, oldImages, oldFavorites, oldPages] =
    await Promise.all([
      fetchOld("categories"),
      fetchOld("vendors"),
      fetchOld("customers"),
      fetchOld("products"),
      fetchOld("product_variants"),
      fetchOld("product_images"),
      fetchOld("product_favorites"),
      fetchOld("pages"),
    ]);

  console.log(
    `Çekildi: ${oldCategories.length} kategori, ${oldVendors.length} satıcı, ${oldCustomers.length} müşteri, ` +
    `${oldProducts.length} ürün, ${oldVariants.length} varyant, ${oldImages.length} görsel, ` +
    `${oldFavorites.length} favori, ${oldPages.length} sayfa`
  );

  // --- Kategori eşlemesi (slug üzerinden, yeni DB'de zaten mevcutlar) ---
  const { rows: newCategories } = await client.query("SELECT id, slug FROM categories");
  const categoryBySlug = new Map(newCategories.map((c) => [c.slug, c.id]));
  const categoryIdMap = new Map(); // oldId -> newId
  for (const oc of oldCategories) {
    const newId = categoryBySlug.get(oc.slug);
    if (newId) categoryIdMap.set(oc.id, newId);
    else console.warn(`Uyarı: kategori slug eşleşmedi: ${oc.slug}`);
  }

  // --- Satıcılar: email üzerinden upsert ---
  const vendorIdMap = new Map(); // oldId -> newId
  for (const v of oldVendors) {
    const { rows } = await client.query(
      `INSERT INTO vendors (store_name, store_slug, email, password_hash, full_name, phone, status,
         wallet_balance, commission_rate, bank_name, bank_iban, bank_account_holder, logo, is_verified, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (email) DO UPDATE SET
         store_name = EXCLUDED.store_name,
         store_slug = EXCLUDED.store_slug,
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         status = EXCLUDED.status,
         wallet_balance = EXCLUDED.wallet_balance,
         commission_rate = EXCLUDED.commission_rate,
         bank_name = EXCLUDED.bank_name,
         bank_iban = EXCLUDED.bank_iban,
         bank_account_holder = EXCLUDED.bank_account_holder,
         logo = EXCLUDED.logo,
         is_verified = EXCLUDED.is_verified
       RETURNING id`,
      [
        v.store_name, v.slug, v.email, v.password, v.full_name, v.phone, v.status,
        v.wallet_balance, v.commission_rate, v.bank_name, v.bank_iban, v.bank_account_holder,
        toMigratedUrl(v.logo), !!v.is_verified, v.created_at,
      ]
    );
    vendorIdMap.set(v.id, rows[0].id);
  }
  console.log(`Satıcılar aktarıldı: ${vendorIdMap.size}`);

  // --- Müşteriler: email üzerinden upsert ---
  const customerIdMap = new Map();
  for (const c of oldCustomers) {
    const fullName = `${c.first_name} ${c.last_name}`.trim();
    const emailVerifiedAt = c.email_verified ? c.created_at : null;
    const { rows } = await client.query(
      `INSERT INTO customers (email, password_hash, full_name, phone, email_verified_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (email) DO UPDATE SET
         password_hash = EXCLUDED.password_hash,
         full_name = EXCLUDED.full_name,
         phone = EXCLUDED.phone,
         email_verified_at = EXCLUDED.email_verified_at
       RETURNING id`,
      [c.email, c.password, fullName, c.phone, emailVerifiedAt, c.created_at]
    );
    customerIdMap.set(c.id, rows[0].id);
  }
  console.log(`Müşteriler aktarıldı: ${customerIdMap.size}`);

  // --- Ürünler ---
  const productIdMap = new Map();
  let skippedDeleted = 0;
  let skippedNoVendor = 0;
  let skippedNoCategory = 0;
  for (const p of oldProducts) {
    if (p.is_deleted) {
      skippedDeleted++;
      continue;
    }
    const newVendorId = vendorIdMap.get(p.vendor_id);
    const newCategoryId = categoryIdMap.get(p.category_id);
    if (!newVendorId) {
      skippedNoVendor++;
      console.warn(`Ürün atlandı (satıcı eşlenemedi): ${p.slug}`);
      continue;
    }
    if (!newCategoryId) {
      skippedNoCategory++;
      console.warn(`Ürün atlandı (kategori eşlenemedi): ${p.slug}`);
      continue;
    }

    const price = parseFloat(p.price);
    const salePrice = p.sale_price !== null ? parseFloat(p.sale_price) : null;
    let basePrice, compareAtPrice;
    if (salePrice !== null && salePrice > 0 && salePrice < price) {
      basePrice = salePrice;
      compareAtPrice = price;
    } else {
      basePrice = price;
      compareAtPrice = null;
    }
    const status = p.is_active ? "active" : "draft";

    const { rows } = await client.query(
      `INSERT INTO products (vendor_id, category_id, name, slug, description, brand, base_price, compare_at_price, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (slug) DO UPDATE SET
         vendor_id = EXCLUDED.vendor_id,
         category_id = EXCLUDED.category_id,
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         brand = EXCLUDED.brand,
         base_price = EXCLUDED.base_price,
         compare_at_price = EXCLUDED.compare_at_price,
         status = EXCLUDED.status,
         updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [newVendorId, newCategoryId, p.name, p.slug, p.description || null, p.brand, basePrice, compareAtPrice, status, p.created_at, p.updated_at]
    );
    const newProductId = rows[0].id;
    productIdMap.set(p.id, { newId: newProductId, sku: p.sku, slug: p.slug, basePrice });

    // Görselleri temizle ve yeniden ekle (idempotent)
    await client.query("DELETE FROM product_images WHERE product_id = $1", [newProductId]);
    let sortOrder = 0;
    if (p.image) {
      await client.query(
        `INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES ($1,$2,$3,$4)`,
        [newProductId, toMigratedUrl(p.image), sortOrder, true]
      );
      sortOrder++;
    }
    const gallery = oldImages.filter((img) => img.product_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
    for (const img of gallery) {
      await client.query(
        `INSERT INTO product_images (product_id, url, sort_order, is_primary) VALUES ($1,$2,$3,$4)`,
        [newProductId, toMigratedUrl(img.image), sortOrder, false]
      );
      sortOrder++;
    }
  }
  console.log(
    `Ürünler aktarıldı: ${productIdMap.size} (atlanan: ${skippedDeleted} silinmiş, ${skippedNoVendor} satıcısız, ${skippedNoCategory} kategorisiz)`
  );

  // --- Varyantlar ---
  let variantCount = 0;
  for (const v of oldVariants) {
    const product = productIdMap.get(v.product_id);
    if (!product) continue;
    const priceDiff = parseFloat(v.price_diff || "0");
    const priceOverride = priceDiff !== 0 ? (product.basePrice + priceDiff).toFixed(2) : null;
    const skuBase = product.sku && product.sku.trim() !== "" ? product.sku : product.slug;
    const sku = `${skuBase}-${v.size || "std"}-${v.color || "std"}`.toLowerCase().replace(/\s+/g, "-");
    await client.query(
      `INSERT INTO product_variants (product_id, sku, size, color, price_override, stock)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (sku) DO UPDATE SET stock = EXCLUDED.stock, price_override = EXCLUDED.price_override`,
      [product.newId, sku, v.size, v.color, priceOverride, v.stock]
    );
    variantCount++;
  }
  console.log(`Varyantlar aktarıldı: ${variantCount}`);

  // --- Favoriler ---
  let favCount = 0;
  for (const f of oldFavorites) {
    const newCustomerId = customerIdMap.get(f.customer_id);
    const product = productIdMap.get(f.product_id);
    if (!newCustomerId || !product) continue;
    await client.query(
      `INSERT INTO product_favorites (customer_id, product_id, created_at) VALUES ($1,$2,$3)
       ON CONFLICT (customer_id, product_id) DO NOTHING`,
      [newCustomerId, product.newId, f.created_at]
    );
    favCount++;
  }
  console.log(`Favoriler aktarıldı: ${favCount}`);

  // --- Sayfalar: sadece eksik olanları ekle, mevcutlara dokunma ---
  let pageCount = 0;
  for (const p of oldPages) {
    const { rowCount } = await client.query(
      `INSERT INTO pages (slug, title, content, show_in_footer, sort_order, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (slug) DO NOTHING`,
      [p.slug, p.title, p.content || "", !!p.show_in_footer, p.sort_order, p.updated_at]
    );
    pageCount += rowCount;
  }
  console.log(`Yeni eklenen sayfalar: ${pageCount} (mevcut sayfalara dokunulmadı)`);

  await client.end();
  console.log("Göç tamamlandı.");
}

main().catch((err) => {
  console.error("Göç hatası:", err);
  process.exit(1);
});
