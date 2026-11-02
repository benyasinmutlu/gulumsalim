DO $$
DECLARE
  giyim_id bigint;
  cocuk_id bigint;
  source_id bigint;
  target_id bigint;
  mapping record;
BEGIN
  INSERT INTO "categories" ("name", "slug", "icon", "image", "sort_order", "is_active")
  VALUES ('Giyim', 'giyim', 'fas fa-shirt', '/category-images/category-ust-giyim.jpg', 1, true)
  ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "parent_id" = NULL,
    "icon" = EXCLUDED."icon",
    "image" = EXCLUDED."image",
    "sort_order" = EXCLUDED."sort_order",
    "is_active" = true
  RETURNING "id" INTO giyim_id;

  INSERT INTO "categories" ("parent_id", "name", "slug", "icon", "image", "sort_order", "is_active")
  VALUES
    (giyim_id, 'Elbise', 'elbise', 'fas fa-person-dress', '/category-images/category-elbiseler.jpg', 1, true),
    (giyim_id, 'Üst Giyim', 'ust-giyim', 'fas fa-shirt', '/category-images/category-bluzlar.jpg', 2, true),
    (giyim_id, 'Alt Giyim', 'alt-giyim', 'fas fa-socks', '/category-images/category-alt-giyim.jpg', 3, true),
    (giyim_id, 'Dış Giyim', 'dis-giyim', 'fas fa-vest', '/category-images/category-dis-giyim.jpg', 4, true)
  ON CONFLICT ("slug") DO UPDATE SET
    "parent_id" = EXCLUDED."parent_id",
    "name" = EXCLUDED."name",
    "icon" = EXCLUDED."icon",
    "image" = EXCLUDED."image",
    "sort_order" = EXCLUDED."sort_order",
    "is_active" = true;

  INSERT INTO "categories" ("name", "slug", "icon", "image", "sort_order", "is_active")
  VALUES
    ('Aksesuar', 'aksesuar', 'fas fa-gem', '/category-images/category-aksesuarlar.jpg', 5, true),
    ('Çantalar', 'cantalar', 'fas fa-bag-shopping', '/category-images/category-cantalar.jpg', 6, true),
    ('Ayakkabılar', 'ayakkabilar', 'fas fa-shoe-prints', '/category-images/category-ayakkabilar.jpg', 7, true),
    ('Kozmetik', 'kozmetik', 'fas fa-spray-can-sparkles', '/uploads/migrated/stock_cosmetics_wikimedia.jpg', 8, true),
    ('Ev & Yaşam', 'ev-yasam', 'fas fa-house', '/uploads/migrated/stock_living_room_wikimedia.jpg', 9, true),
    ('Spor & Outdoor', 'spor-outdoor', 'fas fa-person-running', '/uploads/migrated/stock_running_shoe_wikimedia.jpg', 10, true)
  ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "parent_id" = NULL,
    "icon" = EXCLUDED."icon",
    "image" = EXCLUDED."image",
    "sort_order" = EXCLUDED."sort_order",
    "is_active" = true;

  INSERT INTO "categories" ("name", "slug", "icon", "sort_order", "is_active")
  VALUES ('Çocuk', 'cocuk', '🧸', 11, true)
  ON CONFLICT ("slug") DO UPDATE SET
    "name" = EXCLUDED."name",
    "parent_id" = NULL,
    "icon" = EXCLUDED."icon",
    "sort_order" = EXCLUDED."sort_order",
    "is_active" = true
  RETURNING "id" INTO cocuk_id;

  INSERT INTO "categories" ("parent_id", "name", "slug", "icon", "sort_order", "is_active")
  VALUES
    (cocuk_id, 'Erkek Çocuk', 'erkek-cocuk', '👦', 1, true),
    (cocuk_id, 'Kız Çocuk', 'kiz-cocuk', '👧', 2, true)
  ON CONFLICT ("slug") DO UPDATE SET
    "parent_id" = EXCLUDED."parent_id",
    "name" = EXCLUDED."name",
    "icon" = EXCLUDED."icon",
    "sort_order" = EXCLUDED."sort_order",
    "is_active" = true;

  -- Eski seed'in ürettiği eş anlamlı kategorileri kanonik canlı ağaca taşı.
  -- Kaynak kayıtlar silinmez; eski URL'lerin yönlendirilebilmesi ve audit izi
  -- için pasif tutulur. Bütün bilinen kategori referansları hedefe alınır.
  FOR mapping IN
    SELECT * FROM (VALUES
      ('elbiseler', 'elbise'),
      ('bluzlar', 'ust-giyim'),
      ('pantolonlar', 'alt-giyim'),
      ('etekler', 'alt-giyim'),
      ('ceketler', 'dis-giyim'),
      ('aksesuarlar', 'aksesuar')
    ) AS aliases(source_slug, target_slug)
  LOOP
    SELECT "id" INTO source_id FROM "categories" WHERE "slug" = mapping.source_slug;
    SELECT "id" INTO target_id FROM "categories" WHERE "slug" = mapping.target_slug;

    IF source_id IS NOT NULL AND target_id IS NOT NULL AND source_id <> target_id THEN
      UPDATE "products" SET "category_id" = target_id WHERE "category_id" = source_id;

      DELETE FROM "discover_feedback" source
      USING "discover_feedback" target
      WHERE source."category_id" = source_id
        AND target."category_id" = target_id
        AND source."customer_id" = target."customer_id";
      UPDATE "discover_feedback" SET "category_id" = target_id WHERE "category_id" = source_id;
      UPDATE "discover_events" SET "category_id" = target_id WHERE "category_id" = source_id;
      UPDATE "vendor_feed_sources" SET "default_category_id" = target_id WHERE "default_category_id" = source_id;
      UPDATE "campaigns" SET "scope_id" = target_id WHERE "scope" = 'category' AND "scope_id" = source_id;
      UPDATE "homepage_sections"
      SET "config" = jsonb_set("config", '{categoryId}', to_jsonb(target_id), true)
      WHERE "config" ->> 'categoryId' = source_id::text;
      UPDATE "categories" SET "is_active" = false, "sort_order" = 999 WHERE "id" = source_id;
    END IF;
  END LOOP;

  -- Ayakkabı & Çanta birleşimi semantik olarak otomatik bölünemez. Canlıda
  -- referans yokken güvenle pasife alınır; başka bir ortamda bağlı veri varsa
  -- sessiz yanlış sınıflandırma yapmak yerine migration durur.
  SELECT "id" INTO source_id FROM "categories" WHERE "slug" = 'ayakkabi-canta';
  IF source_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM "products" WHERE "category_id" = source_id)
      OR EXISTS (SELECT 1 FROM "discover_feedback" WHERE "category_id" = source_id)
      OR EXISTS (SELECT 1 FROM "discover_events" WHERE "category_id" = source_id)
      OR EXISTS (SELECT 1 FROM "vendor_feed_sources" WHERE "default_category_id" = source_id)
      OR EXISTS (SELECT 1 FROM "campaigns" WHERE "scope" = 'category' AND "scope_id" = source_id)
      OR EXISTS (SELECT 1 FROM "homepage_sections" WHERE "config" ->> 'categoryId' = source_id::text)
    THEN
      RAISE EXCEPTION 'ayakkabi-canta kategorisinde manuel olarak cantalar/ayakkabilar ayrımı gerektiren bağlı veri var';
    END IF;

    UPDATE "categories" SET "is_active" = false, "sort_order" = 999 WHERE "id" = source_id;
  END IF;
END $$;
