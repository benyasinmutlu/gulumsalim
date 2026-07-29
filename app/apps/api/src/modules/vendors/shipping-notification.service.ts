import { env } from "../../config/env";
import { renderShippingNotification } from "../../lib/emails/shipping-notification";
import { sendMail } from "../../lib/mailer";
import { getShippedItemNotificationData } from "./vendor-orders.repository";

// Bir sipariş kalemi "shipped"a geçtiğinde müşteriye kargo takip e-postası
// gönderir. Route katmanından best-effort (fire-and-forget) çağrılır -
// gönderim başarısızlığı kargolama işlemini ya da HTTP yanıtını BOZMAZ.
//
// Veri eksikse (kalem bulunamadı / takip bilgisi yok) sessizce false döner:
// zod şeması takip bilgisini zaten zorunlu kılar, bu yalnız savunma amaçlı.
export async function sendShippingNotification(orderItemId: number): Promise<boolean> {
  const data = await getShippedItemNotificationData(orderItemId);
  if (!data || !data.customerEmail || !data.trackingCarrier || !data.trackingNumber) {
    return false;
  }

  const { subject, html } = renderShippingNotification({
    orderNumber: data.orderNumber,
    productName: data.productNameSnapshot,
    quantity: data.quantity,
    carrier: data.trackingCarrier,
    trackingNumber: data.trackingNumber,
    siteUrl: env.SITE_URL,
  });

  await sendMail(data.customerEmail, subject, html);
  return true;
}
