// Müşteri-satıcı serbest metin alanlarında (mesaj, soru/cevap, yorum, şikayet)
// IBAN/telefon/e-posta/sosyal medya gibi iletişim bilgisi paylaşımını
// engellemek için kullanılır - platform dışına çıkıp komisyonsuz anlaşma
// yapılmasının önüne geçer (bkz. kullanıcı isteği: "IBAN telefon numarası
// iletişim gibi şeyleri yazdıklarında engellenmeli"). Checksum'a bakmadan
// desen eşleşmesi yeterli - amaç geçerli bir IBAN doğrulamak değil, paylaşım
// girişimini yakalamak.

const IBAN_PATTERN = /\bTR\d{2}(?:[ -]?\d{4}){5}[ -]?\d{2}\b/i;

// Türkiye cep/sabit hat: 0/+90 ile başlayan ya da başlamayan, boşluk/tire ile
// ayrılmış 10 haneli numaralar (05xx xxx xx xx, 0212 xxx xx xx, +90...).
const PHONE_PATTERN = /(?:\+?90[ -]?)?0?\s?5\d{2}[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}\b|(?:\+?90[ -]?)?0?\s?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}\b/;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

// Uzun ardışık rakam bloğu - yukarıdaki desenlere uymayan ama yine de
// telefon/hesap no olabilecek serbest biçimli sayılar için genel yakalayıcı.
const LONG_DIGIT_RUN_PATTERN = /\b\d[\d -]{8,}\d\b/;

const SOCIAL_CONTACT_PATTERN = /(wa\.me|api\.whatsapp\.com|t\.me\/|instagram\.com\/|telegram|whatsapp'?tan|whatsapptan|@[a-z0-9_.]{3,})/i;

const URL_PATTERN = /https?:\/\/|www\./i;

export function containsContactInfo(text: string): boolean {
  return (
    IBAN_PATTERN.test(text) ||
    EMAIL_PATTERN.test(text) ||
    URL_PATTERN.test(text) ||
    SOCIAL_CONTACT_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    LONG_DIGIT_RUN_PATTERN.test(text)
  );
}

export const CONTACT_INFO_MESSAGE = "Mesajınız telefon numarası, IBAN, e-posta veya başka bir iletişim bilgisi içeremez.";
