import { and, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { customerAddresses } from "../../db/schema/index";

interface AddressInput {
  fullName: string;
  phone: string;
  city: string;
  district: string;
  addressLine: string;
  zipCode?: string;
  isDefault?: boolean;
}

export async function listAddressesByCustomer(customerId: number) {
  return db
    .select()
    .from(customerAddresses)
    .where(eq(customerAddresses.customerId, customerId))
    .orderBy(customerAddresses.isDefault, customerAddresses.createdAt);
}

// isDefault=true seçildiğinde diğer adreslerin default bayrağı aynı
// transaction içinde temizlenir - aynı anda birden fazla varsayılan adres
// asla oluşamaz.
export async function createAddress(customerId: number, input: AddressInput) {
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, customerId));
    }
    const [row] = await tx
      .insert(customerAddresses)
      .values({ customerId, ...input })
      .returning();
    return row;
  });
}

export async function updateAddress(customerId: number, addressId: number, input: AddressInput) {
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx.update(customerAddresses).set({ isDefault: false }).where(eq(customerAddresses.customerId, customerId));
    }
    const [row] = await tx
      .update(customerAddresses)
      .set(input)
      .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
      .returning();
    return row ?? null;
  });
}

export async function deleteAddress(customerId: number, addressId: number) {
  const rows = await db
    .delete(customerAddresses)
    .where(and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)))
    .returning();
  return rows.length > 0;
}
