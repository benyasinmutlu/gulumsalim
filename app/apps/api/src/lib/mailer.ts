import { Resend } from "resend";
import { env } from "../config/env";

const resend = new Resend(env.RESEND_API_KEY);

export async function sendMail(to: string, subject: string, html: string) {
  const { error } = await resend.emails.send({ from: env.SMTP_FROM, to, subject, html });
  if (error) throw new Error(`Resend gönderim hatası: ${error.message}`);
}

// ---- E-posta tasarım sistemi -------------------------------------------
// bkz. kullanıcı isteği: "gönderilen mail tasarım olarak çok daha iyi olsun
// ... tam profesyonel olsun". E-posta istemcileri (Outlook özellikle) modern
// CSS'in çoğunu (flexbox/grid, box-shadow bazı istemcilerde) desteklemediği
// için layout TABLO tabanlı, stiller SATIR İÇİ (inline) - bu bir web sayfası
// değil, bir e-posta.

const BRAND_PRIMARY = "#CC7C94";
const BRAND_PRIMARY_DARK = "#A34D6E";
const BRAND_BG = "#FFF8F5";
const TEXT = "#2D2D2D";
const TEXT_LIGHT = "#6B6B6B";
const TEXT_MUTED = "#9B9B9B";
const BORDER = "#F0E6E0";

function absoluteUrl(path: string) {
  return path.startsWith("http") ? path : `${env.SITE_URL}${path}`;
}

// Her e-postanın gövdesi bu ortak kabuğa sarılır - marka başlığı (logo +
// gradyan), beyaz içerik kartı, alt bilgi. `preheader`, e-posta istemcisinin
// gelen kutusu önizlemesinde konu satırının hemen altında görünen (ama
// e-postanın kendi içinde görünmez) kısa özet metnidir.
export function renderEmailLayout(preheader: string, bodyHtml: string) {
  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Gülüm Şalım</title>
</head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:${BRAND_PRIMARY_DARK};background:linear-gradient(135deg,${BRAND_PRIMARY},${BRAND_PRIMARY_DARK});padding:28px 32px;text-align:center;">
              <span style="font-size:26px;line-height:1;">🌸</span>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:#ffffff;margin-top:6px;letter-spacing:0.2px;">Gülüm Şalım</div>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px;color:${TEXT};font-size:15px;line-height:1.65;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND_BG};padding:22px 32px;text-align:center;border-top:1px solid ${BORDER};">
              <div style="font-size:12px;color:${TEXT_MUTED};line-height:1.7;">
                © 2026 Gülüm Şalım · Kadın Giyim<br>
                <a href="${env.SITE_URL}" style="color:${BRAND_PRIMARY_DARK};text-decoration:none;">gulumsalim.com</a>
                &nbsp;·&nbsp;
                <a href="${env.SITE_URL}/iletisim" style="color:${TEXT_MUTED};text-decoration:underline;">İletişim</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function emailHeading(text: string) {
  return `<h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:700;color:${TEXT};">${text}</h1>`;
}

export function emailButton(href: string, label: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px auto;">
    <tr>
      <td style="border-radius:50px;background:${BRAND_PRIMARY};">
        <a href="${href}" style="display:inline-block;padding:14px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:50px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

// Ürün resimli satır - sipariş kalemleri, sepet hatırlatma, favoriler
// e-postalarında ortak kullanılır. Görsel yoksa (bazı ürünlerde olabilir)
// sahte bir görsel uydurulmaz, marka rengiyle nötr bir ikon kutusu gösterilir.
export function emailProductRow(params: { image: string | null; name: string; meta: string; priceHtml: string; href?: string }) {
  const { image, name, meta, priceHtml, href } = params;
  const imageCell = image
    ? `<img src="${absoluteUrl(image)}" width="64" height="64" alt="" style="display:block;width:64px;height:64px;border-radius:10px;object-fit:cover;">`
    : `<div style="width:64px;height:64px;border-radius:10px;background:#FFF0EB;color:${BRAND_PRIMARY_DARK};font-size:22px;text-align:center;line-height:64px;">🌸</div>`;
  const nameHtml = href ? `<a href="${absoluteUrl(href)}" style="color:${TEXT};text-decoration:none;font-weight:600;">${name}</a>` : `<span style="font-weight:600;">${name}</span>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
    <tr>
      <td width="64" valign="top" style="padding-right:14px;">${imageCell}</td>
      <td valign="top" style="font-size:14px;color:${TEXT};">
        <div>${nameHtml}</div>
        <div style="color:${TEXT_LIGHT};margin-top:2px;font-size:13px;">${meta}</div>
        <div style="margin-top:4px;">${priceHtml}</div>
      </td>
    </tr>
  </table>`;
}

export function emailMuted(text: string) {
  return `<p style="color:${TEXT_MUTED};font-size:13px;line-height:1.6;">${text}</p>`;
}

export function emailDivider() {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;">`;
}
