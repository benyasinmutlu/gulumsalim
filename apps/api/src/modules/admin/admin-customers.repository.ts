import { desc, or, ilike, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { customerAddresses, customers, orders } from "../../db/schema/index";

export async function listCustomers(search?: string) {
  const base = db
    .select({
      id: customers.id,
      email: customers.email,
      fullName: customers.fullName,
      phone: customers.phone,
      emailVerifiedAt: customers.emailVerifiedAt,
      createdAt: customers.createdAt,
      isGuest: customers.isGuest,
      orderCount: sql<number>`(SELECT COUNT(*) FROM ${orders} WHERE ${orders.customerId} = ${customers.id})`,
      // Kayıtlı varsayılan adresten - eski sitede customer'ın kendi
      // şehir/ilçe kolonu vardı, yeni şemada bu bilgi adres defterinde.
      city: sql<string | null>`(SELECT ${customerAddresses.city} FROM ${customerAddresses} WHERE ${customerAddresses.customerId} = ${customers.id} AND ${customerAddresses.isDefault} = true LIMIT 1)`,
      district: sql<string | null>`(SELECT ${customerAddresses.district} FROM ${customerAddresses} WHERE ${customerAddresses.customerId} = ${customers.id} AND ${customerAddresses.isDefault} = true LIMIT 1)`,
      totalSpent: sql<string>`COALESCE((SELECT SUM(${orders.total}) FROM ${orders} WHERE ${orders.customerId} = ${customers.id} AND ${orders.paymentStatus} = 'paid'), 0)`,
    })
    .from(customers)
    .orderBy(desc(customers.createdAt))
    .limit(200);

  if (search) {
    return base.where(or(ilike(customers.fullName, `%${search}%`), ilike(customers.email, `%${search}%`)));
  }
  return base;
}
