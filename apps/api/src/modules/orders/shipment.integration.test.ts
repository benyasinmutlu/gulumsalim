import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

// bkz. kargo/PTT denetim raporu Faz 2 (2026-09-10): Shipment domain modeli
// gerçek transaction/FK/unique-constraint davranışına bağlı (onConflictDoNothing,
// çoklu satıcı gruplama, markOrderPaid'in idempotency garantisi) - bunları
// mock'lamak yerine outbox-claim.integration.test.ts / merchant-feed.integration.
// test.ts ile AYNI kurulan desen (INTEGRATION_DATABASE_URL verilirse çalışır,
// verilmezse atlanır) tekrarlandı.
const integrationDatabaseUrl = process.env.INTEGRATION_DATABASE_URL;

describe.runIf(Boolean(integrationDatabaseUrl))("shipment domain integration", () => {
  let db: (typeof import("../../db/client"))["db"];
  let pool: (typeof import("../../db/client"))["pool"];
  let schema: typeof import("../../db/schema/index");
  let createOrder: (typeof import("./order.repository"))["createOrder"];
  let markOrderPaid: (typeof import("./order.repository"))["markOrderPaid"];
  let markOrderPaymentFailed: (typeof import("./order.repository"))["markOrderPaymentFailed"];
  let transitionOrderItemStatus: (typeof import("../vendors/vendor-orders.service"))["transitionOrderItemStatus"];

  let categoryId: number;
  let vendorAId: number; // kargo profili DOLU
  let vendorBId: number; // kargo profili DOLU
  let vendorCId: number; // kargo profili BOŞ (Faz 1 alanları hiç girilmemiş)
  let productAId: number;
  let productBId: number;
  let productCId: number;
  let customerId: number;

  const suffix = Date.now();
  const recipient = {
    fullName: "Test Alıcı",
    phone: "05551112233",
    city: "İstanbul",
    district: "Kadıköy",
    addressLine: "Test Mahallesi Test Sokak No:1",
    zipCode: "34710",
  };

  async function makeVendor(label: string, shippingProfile: boolean) {
    const [vendor] = await db
      .insert(schema.vendors)
      .values({
        storeName: `Shipment Test ${label}`,
        storeSlug: `shipment-test-${label.toLowerCase()}-${suffix}`,
        email: `shipment-${label.toLowerCase()}-${suffix}@test.invalid`,
        passwordHash: "test",
        fullName: `Shipment Test ${label}`,
        status: "active",
        ...(shippingProfile
          ? {
              shippingContactName: `${label} Depo Sorumlusu`,
              shippingContactPhone: "05559998877",
              shippingCity: "Ankara",
              shippingDistrict: "Çankaya",
              shippingAddressLine: `${label} Depo Adresi No:${label}`,
            }
          : {}),
      })
      .returning();
    return vendor!.id;
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = integrationDatabaseUrl!;
    ({ db, pool } = await import("../../db/client"));
    schema = await import("../../db/schema/index");
    ({ createOrder, markOrderPaid, markOrderPaymentFailed } = await import("./order.repository"));
    ({ transitionOrderItemStatus } = await import("../vendors/vendor-orders.service"));

    const [category] = await db.insert(schema.categories).values({ name: "Shipment test", slug: `shipment-test-${suffix}` }).returning();
    categoryId = category!.id;

    vendorAId = await makeVendor("A", true);
    vendorBId = await makeVendor("B", true);
    vendorCId = await makeVendor("C", false);

    const [customer] = await db
      .insert(schema.customers)
      .values({ email: `shipment-customer-${suffix}@test.invalid`, fullName: "Shipment Test Müşteri" })
      .returning();
    customerId = customer!.id;

    async function makeProduct(vendorId: number, label: string) {
      const [product] = await db
        .insert(schema.products)
        .values({
          vendorId,
          categoryId,
          name: `Shipment Test Ürün ${label}`,
          slug: `shipment-test-urun-${label.toLowerCase()}-${suffix}`,
          basePrice: "100.00",
          stock: 100,
          status: "active",
        })
        .returning();
      return product!.id;
    }
    productAId = await makeProduct(vendorAId, "A");
    productBId = await makeProduct(vendorBId, "B");
    productCId = await makeProduct(vendorCId, "C");
  }, 30_000);

  afterAll(async () => {
    await pool?.end();
  });

  // bkz. rapor bölüm 14: Order #1001 örneği - Seller A (2 item), Seller B
  // (1 item), Seller C (2 item) -> 3 Shipment bekleniyor.
  it("gruplar: 3 satıcılı sipariş 3 shipment üretir, kalemler doğru shipment'a bağlanır", async () => {
    const orderNumber = `SHT-MULTI-${suffix}`;
    const items = [
      { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün 1", unitPrice: "100.00", quantity: 1, total: "100.00" },
      { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-2`, productNameSnapshot: "A ürün 2", unitPrice: "100.00", quantity: 1, total: "100.00" },
      { vendorId: vendorBId, productId: productBId, paymentItemRef: `${orderNumber}-3`, productNameSnapshot: "B ürün 1", unitPrice: "100.00", quantity: 1, total: "100.00" },
      { vendorId: vendorCId, productId: productCId, paymentItemRef: `${orderNumber}-4`, productNameSnapshot: "C ürün 1", unitPrice: "100.00", quantity: 1, total: "100.00" },
      { vendorId: vendorCId, productId: productCId, paymentItemRef: `${orderNumber}-5`, productNameSnapshot: "C ürün 2", unitPrice: "100.00", quantity: 1, total: "100.00" },
    ];
    const { order, items: insertedItems } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "500.00",
      shippingFee: "0.00",
      total: "500.00",
      shippingAddress: recipient,
      items,
    });

    // Ödeme henüz onaylanmadı - şu an HİÇ shipment olmamalı.
    const beforePaid = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(beforePaid).toHaveLength(0);

    const paid = await markOrderPaid(
      order.id,
      "test-payment-id",
      insertedItems.map((item) => ({ orderItemId: item.id, paymentTransactionId: `${item.id}-txn` })),
    );
    expect(paid).toBe(true);

    const createdShipments = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(createdShipments).toHaveLength(3);
    expect(new Set(createdShipments.map((s) => s.vendorId))).toEqual(new Set([vendorAId, vendorBId, vendorCId]));

    const refreshedItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    const shipmentByVendor = new Map(createdShipments.map((s) => [s.vendorId, s]));

    const vendorAItems = refreshedItems.filter((i) => i.vendorId === vendorAId);
    expect(vendorAItems).toHaveLength(2);
    expect(vendorAItems.every((i) => i.shipmentId === shipmentByVendor.get(vendorAId)!.id)).toBe(true);

    const vendorBItems = refreshedItems.filter((i) => i.vendorId === vendorBId);
    expect(vendorBItems).toHaveLength(1);
    expect(vendorBItems[0]!.shipmentId).toBe(shipmentByVendor.get(vendorBId)!.id);

    const vendorCItems = refreshedItems.filter((i) => i.vendorId === vendorCId);
    expect(vendorCItems).toHaveLength(2);
    expect(vendorCItems.every((i) => i.shipmentId === shipmentByVendor.get(vendorCId)!.id)).toBe(true);

    // Sender snapshot: A/B dolu profil kopyalanmalı, C (profil boş) null kalmalı.
    const shipmentA = shipmentByVendor.get(vendorAId)!;
    expect(shipmentA.senderName).toBe("A Depo Sorumlusu");
    expect(shipmentA.senderCity).toBe("Ankara");
    const shipmentC = shipmentByVendor.get(vendorCId)!;
    expect(shipmentC.senderName).toBeNull();
    expect(shipmentC.senderCity).toBeNull();

    // Recipient snapshot: hepsinde sipariş adresinin birebir kopyası olmalı.
    for (const shipment of createdShipments) {
      expect(shipment.recipientName).toBe(recipient.fullName);
      expect(shipment.recipientCity).toBe(recipient.city);
      expect(shipment.recipientDistrict).toBe(recipient.district);
      expect(shipment.recipientAddressLine).toBe(recipient.addressLine);
      expect(shipment.status).toBe("created");
      expect(shipment.direction).toBe("outbound");
    }
  });

  it("tek satıcılı sipariş tam olarak 1 shipment üretir", async () => {
    const orderNumber = `SHT-SINGLE-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    await markOrderPaid(order.id, "test-payment-id", items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` })));

    const createdShipments = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(createdShipments).toHaveLength(1);
    expect(createdShipments[0]!.vendorId).toBe(vendorAId);
  });

  it("ödemesi başarısız olan sipariş için hiç shipment oluşturulmaz", async () => {
    const orderNumber = `SHT-FAILED-${suffix}`;
    const { order } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    const failed = await markOrderPaymentFailed(order.id);
    expect(failed).toBe(true);

    const createdShipments = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(createdShipments).toHaveLength(0);
  });

  it("aynı sipariş için ikinci kez markOrderPaid çağrılması (duplicate webhook) yeni shipment üretmez", async () => {
    const orderNumber = `SHT-DUPE-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    const paymentItems = items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` }));

    const first = await markOrderPaid(order.id, "test-payment-id", paymentItems);
    expect(first).toBe(true);
    // İkinci çağrı: orders.paymentStatus artık 'pending' değil, WHERE koşulu
    // hiçbir satır döndürmez -> false, hiçbir yeni shipment satırı eklenmez.
    const second = await markOrderPaid(order.id, "test-payment-id", paymentItems);
    expect(second).toBe(false);

    const createdShipments = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(createdShipments).toHaveLength(1);
  });

  it("satıcı kalemi 'shipped' işaretlediğinde bağlı shipment senkronize olur, eski tracking alanları bozulmaz", async () => {
    const orderNumber = `SHT-TRACK-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    await markOrderPaid(order.id, "test-payment-id", items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` })));

    await transitionOrderItemStatus(vendorAId, items[0]!.id, "processing");
    await transitionOrderItemStatus(vendorAId, items[0]!.id, "shipped", { carrier: "PTT Kargo", number: "TRK-123" });

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, items[0]!.id));
    // Eski (legacy) alanlar hâlâ doluyor - geriye dönük uyumluluk bozulmadı.
    expect(updatedItem!.trackingCarrier).toBe("PTT Kargo");
    expect(updatedItem!.trackingNumber).toBe("TRK-123");
    expect(updatedItem!.shipmentId).not.toBeNull();

    const [shipment] = await db.select().from(schema.shipments).where(eq(schema.shipments.id, updatedItem!.shipmentId!));
    expect(shipment!.carrierName).toBe("PTT Kargo");
    expect(shipment!.trackingNumber).toBe("TRK-123");
    expect(shipment!.status).toBe("shipped");
    expect(shipment!.shippedAt).not.toBeNull();
  });

  it("tek kalemli shipment teslim edilince shipment 'delivered' olur", async () => {
    const orderNumber = `SHT-DELIVERED-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    await markOrderPaid(order.id, "test-payment-id", items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` })));
    await transitionOrderItemStatus(vendorAId, items[0]!.id, "processing");
    await transitionOrderItemStatus(vendorAId, items[0]!.id, "shipped", { carrier: "Aras Kargo", number: "TRK-999" });
    await transitionOrderItemStatus(vendorAId, items[0]!.id, "delivered");

    const [updatedItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, items[0]!.id));
    const [shipment] = await db.select().from(schema.shipments).where(eq(schema.shipments.id, updatedItem!.shipmentId!));
    expect(shipment!.status).toBe("delivered");
    expect(shipment!.deliveredAt).not.toBeNull();
  });

  it("bir shipment'taki kalemlerden biri iptal olsa bile diğeri kargoya verilince shipment 'shipped' olur", async () => {
    const orderNumber = `SHT-PARTIAL-CANCEL-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "200.00",
      shippingFee: "0.00",
      total: "200.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün 1", unitPrice: "100.00", quantity: 1, total: "100.00" },
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-2`, productNameSnapshot: "A ürün 2", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    await markOrderPaid(order.id, "test-payment-id", items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` })));

    // Aynı shipment'taki iki kalemden biri iptal, diğeri kargoya verilir.
    await transitionOrderItemStatus(vendorAId, items[0]!.id, "cancelled");
    await transitionOrderItemStatus(vendorAId, items[1]!.id, "processing");
    await transitionOrderItemStatus(vendorAId, items[1]!.id, "shipped", { carrier: "MNG Kargo", number: "TRK-777" });

    const [cancelledItem] = await db.select().from(schema.orderItems).where(eq(schema.orderItems.id, items[0]!.id));
    const shipmentId = cancelledItem!.shipmentId!;
    const [shipment] = await db.select().from(schema.shipments).where(eq(schema.shipments.id, shipmentId));
    // İptal olmayan (relevant) tek kalem kargoya verildiği için shipment "shipped".
    expect(shipment!.status).toBe("shipped");
  });

  it("aynı (order, vendor) için ikinci kez shipment oluşturmaya çalışmak (defense-in-depth) satır çoğaltmaz", async () => {
    const orderNumber = `SHT-IDEMPOTENT-${suffix}`;
    const { order, items } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    await markOrderPaid(order.id, "test-payment-id", items.map((i) => ({ orderItemId: i.id, paymentTransactionId: `${i.id}-txn` })));

    const { createShipmentsForOrder } = await import("./shipment.repository");
    // DB seviyesindeki uniq_shipments_order_vendor kısıtının gerçekten
    // çalıştığını doğrudan doğrula (markOrderPaid'in kendi koruması bypass
    // edilip fonksiyon elle ikinci kez çağrılsa bile).
    await db.transaction(async (tx) => {
      await createShipmentsForOrder(tx, order.id, recipient);
    });

    const createdShipments = await db.select().from(schema.shipments).where(eq(schema.shipments.orderId, order.id));
    expect(createdShipments).toHaveLength(1);
  });

  it("eski (Faz 2 öncesi) sipariş gibi shipmentId'si hiç dolmamış kalemler sorunsuz okunabilir", async () => {
    const orderNumber = `SHT-LEGACY-${suffix}`;
    const { order } = await createOrder({
      customerId,
      orderNumber,
      subtotal: "100.00",
      shippingFee: "0.00",
      total: "100.00",
      shippingAddress: recipient,
      items: [
        { vendorId: vendorAId, productId: productAId, paymentItemRef: `${orderNumber}-1`, productNameSnapshot: "A ürün", unitPrice: "100.00", quantity: 1, total: "100.00" },
      ],
    });
    // Ödeme HİÇ onaylanmadı - bu, Faz 2 öncesi/hiç ödenmemiş bir sipariş
    // gibi shipmentId'si null kalan bir kalemi temsil eder.
    const legacyItems = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id));
    expect(legacyItems).toHaveLength(1);
    expect(legacyItems[0]!.shipmentId).toBeNull();
  });
});
