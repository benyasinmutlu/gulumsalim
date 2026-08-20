// Kargo takip bildirimi e-postası - SAF (yan etkisiz) şablon. SMTP'den
// bağımsız test edilebilir. Dinamik/kullanıcı kaynaklı alanlar (ürün adı,
// kargo firması, takip no) e-posta HTML'ine gömülmeden önce KAÇIŞLANIR -
// aksi halde ürün adına gömülü bir <script>/<img> müşterinin mail
// istemcisinde HTML enjeksiyonuna yol açabilirdi.

export interface ShippingNotificationInput {
  orderNumber: string;
  productName: string;
  quantity: number;
  carrier: string;
  trackingNumber: string;
  // Config'ten gelir (env.SITE_URL) - domain hardcode edilmez.
  siteUrl?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderShippingNotification(input: ShippingNotificationInput): { subject: string; html: string } {
  const orderNumber = escapeHtml(input.orderNumber);
  const productName = escapeHtml(input.productName);
  const carrier = escapeHtml(input.carrier);
  const trackingNumber = escapeHtml(input.trackingNumber);
  const quantity = Number.isFinite(input.quantity) ? input.quantity : 1;

  const subject = `Siparişiniz kargoya verildi — ${orderNumber}`;

  const ordersLink = input.siteUrl ? `${input.siteUrl.replace(/\/+$/, "")}/hesabim/siparisler` : null;
  const ctaBlock = ordersLink
    ? `<tr><td style="padding:8px 0 0;">
         <a href="${escapeHtml(ordersLink)}" style="display:inline-block;background:#C06C84;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">Siparişlerimi Gör</a>
       </td></tr>`
    : "";

  // E-posta istemcileri için tablo tabanlı, inline stilli, marka renkli
  // (rose/gold) sade bir düzen.
  const html = `<!doctype html>
<html lang="tr">
<body style="margin:0;padding:0;background:#FFF8F5;font-family:'Segoe UI',Arial,sans-serif;color:#2D2D2D;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF8F5;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #F0E6E0;border-radius:16px;overflow:hidden;">
        <tr><td style="background:linear-gradient(135deg,#C06C84,#D4A574);padding:28px 32px;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;color:#ffffff;">🌸 Gülüm Şalım</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#2D2D2D;">Siparişiniz yola çıktı 🚚</h1>
          <p style="margin:0 0 24px;font-size:15px;color:#6B6B6B;line-height:1.6;">
            <strong>${orderNumber}</strong> numaralı siparişinizdeki ürün kargoya verildi. Aşağıdaki takip numarasıyla gönderinizi izleyebilirsiniz.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFF0EB;border-radius:12px;">
            <tr><td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;color:#2D2D2D;">
                <tr><td style="padding:6px 0;color:#9B9B9B;">Ürün</td><td style="padding:6px 0;text-align:right;font-weight:600;">${productName}${quantity > 1 ? ` × ${quantity}` : ""}</td></tr>
                <tr><td style="padding:6px 0;color:#9B9B9B;">Kargo Firması</td><td style="padding:6px 0;text-align:right;font-weight:600;">${carrier}</td></tr>
                <tr><td style="padding:6px 0;color:#9B9B9B;">Takip Numarası</td><td style="padding:6px 0;text-align:right;font-weight:700;color:#8B3A62;">${trackingNumber}</td></tr>
              </table>
            </td></tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px;">${ctaBlock}</table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #F5EDE8;font-size:12px;color:#9B9B9B;">
          Bu e-posta Gülüm Şalım siparişiniz hakkında bilgilendirme amacıyla gönderilmiştir.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
