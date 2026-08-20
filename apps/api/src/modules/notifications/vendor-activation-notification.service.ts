import { env } from "../../config/env";
import { emailButton, emailHeading, emailMuted, renderEmailLayout, sendMail } from "../../lib/mailer";
import { createNotification } from "./notifications.repository";

interface ActivatedVendor {
  id: number;
  email: string;
  fullName: string;
  storeName: string;
}

// Aktivasyonun kendisi bildirim servisinden bağımsız olarak tamamlanır.
// E-posta sağlayıcısındaki geçici bir sorun admin onayını geri çevirmemeli;
// site içi bildirim ve e-posta ayrı ayrı denenir ve hata gözlemlenebilir kalır.
export async function notifyVendorActivated(vendor: ActivatedVendor): Promise<void> {
  const panelUrl = `${env.SITE_URL}/satici/panel`;
  const title = "Üyeliğiniz Onaylandı";
  const message = `${vendor.storeName} satıcı hesabınız onaylandı. Ürünlerinizi ekleyip satışa başlayabilirsiniz.`;
  const body =
    emailHeading(title) +
    `<p>Merhaba ${vendor.fullName},</p>` +
    `<p><strong>${vendor.storeName}</strong> satıcı hesabınız onaylandı ve kullanıma açıldı.</p>` +
    `<p>Satıcı panelinden ürünlerinizi ekleyebilir ve mağazanızı yönetebilirsiniz.</p>` +
    emailButton(panelUrl, "Satıcı Paneline Git") +
    emailMuted("Bu e-posta Gülüm Şalım üyelik başvurunuzla ilgili otomatik olarak gönderilmiştir.");

  const results = await Promise.allSettled([
    createNotification(vendor.id, "membership_approved", title, message, "/satici/panel"),
    sendMail(vendor.email, `${title} - Gülüm Şalım`, renderEmailLayout("Satıcı hesabınız kullanıma açıldı", body)),
  ]);

  for (const result of results) {
    if (result.status === "rejected") console.error("Satıcı aktivasyon bildirimi gönderilemedi", result.reason);
  }
}
