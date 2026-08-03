// Müşteri mesajları için hafif, kural-tabanlı sınıflandırma + moderasyon.
// Tamamen istemci tarafında çalışır (backend/DB değişikliği yok): satıcı
// mesajları görürken küfür/spam işaretlenir, küfür maskelenir, mesajlar
// şikayet/soru/normal olarak kategorize edilir - böylece günde 100 mesaj gelse
// bile satıcı neyin önemli olduğunu tek bakışta görür.

export type MessageCategory = "abuse" | "spam" | "complaint" | "question" | "normal";

export interface MessageClassification {
  category: MessageCategory;
  flagged: boolean; // abuse veya spam -> dikkat gerektirir
  maskedText: string;
}

// Yaygın Türkçe küfür/hakaret kökleri (kısmi eşleşme için). Liste bilinçli
// olarak kısa + yüksek-kesinlikli tutuldu; yanlış-pozitifi azaltmak için kelime
// sınırı kontrolü yapılır.
const PROFANITY = [
  "amk", "aq", "oç", "orospu", "orosbu", "piç", "göt", "got ", "sik", "siktir", "sikeyim", "amına", "amina",
  "amcık", "amcik", "yarrak", "yarak", "yavşak", "yavsak", "şerefsiz", "serefsiz", "ibne", "pezevenk", "kahpe",
  "puşt", "pust", "gavat", "kaltak", "sürtük", "surtuk", "salak", "gerizekalı", "gerizekali", "aptal", "mal herif",
  "dangalak", "öküz", "hayvan herif", "it oğlu", "pislik herif",
];

const COMPLAINT_WORDS = [
  "iade", "iptal", "geri ödeme", "para iadesi", "kötü", "berbat", "rezalet", "rezil", "şikayet", "sikayet",
  "dolandırıcı", "dolandirici", "sahte", "bozuk", "kırık", "kirik", "yırtık", "yirtik", "leke", "kusurlu",
  "gelmedi", "geç geldi", "ulaşmadı", "ulasmadi", "memnun değil", "memnun degil", "hayal kırıklığı",
  "eksik", "yanlış ürün", "yanlis urun", "kandırıldım", "kandirildim", "çürük", "curuk",
];

const QUESTION_WORDS = [
  "nasıl", "nasil", "ne zaman", "kaç", "kac", "hangi", "nerede", "var mı", "var mi", "mümkün mü", "mumkun mu",
  "kaça", "kaca", "ne kadar", "olur mu", "mevcut mu", "stok var",
];

const SPAM_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b\d{10,}\b/, // uzun rakam dizisi (telefon/hesap no)
  /(.)\1{6,}/, // aynı karakterin 7+ tekrarı
  /(bit\.ly|t\.me|wa\.me|instagram\.com\/|telegram)/i,
];

const TR_LOWER = (s: string) => s.toLocaleLowerCase("tr-TR");

function hasWord(haystackLower: string, needleLower: string): boolean {
  // Türkçe harfleri de sınır sayan basit kelime-sınırı kontrolü.
  const boundary = "[^a-zçğıöşü0-9]";
  const re = new RegExp(`(^|${boundary})${needleLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(${boundary}|$)`, "i");
  return re.test(haystackLower);
}

function maskProfanity(text: string): string {
  let out = text;
  for (const w of PROFANITY) {
    const core = w.trim();
    if (core.length < 2) continue;
    const re = new RegExp(core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    out = out.replace(re, (m) => m[0] + "•".repeat(Math.max(1, m.length - 1)));
  }
  return out;
}

export function classifyMessage(text: string): MessageClassification {
  const lower = TR_LOWER(text);

  if (PROFANITY.some((w) => hasWord(lower, TR_LOWER(w.trim())))) {
    return { category: "abuse", flagged: true, maskedText: maskProfanity(text) };
  }
  if (SPAM_PATTERNS.some((p) => p.test(text))) {
    return { category: "spam", flagged: true, maskedText: text };
  }
  if (COMPLAINT_WORDS.some((w) => lower.includes(TR_LOWER(w)))) {
    return { category: "complaint", flagged: false, maskedText: text };
  }
  if (text.includes("?") || QUESTION_WORDS.some((w) => lower.includes(TR_LOWER(w)))) {
    return { category: "question", flagged: false, maskedText: text };
  }
  return { category: "normal", flagged: false, maskedText: text };
}

export const CATEGORY_META: Record<MessageCategory, { label: string; cls: string; icon: string }> = {
  abuse: { label: "Küfür/Hakaret", cls: "st-danger", icon: "fa-triangle-exclamation" },
  spam: { label: "Spam", cls: "st-warn", icon: "fa-ban" },
  complaint: { label: "Şikayet", cls: "st-warn", icon: "fa-circle-exclamation" },
  question: { label: "Soru", cls: "st-info", icon: "fa-circle-question" },
  normal: { label: "Normal", cls: "st-muted", icon: "fa-comment" },
};

// Satıcının günde onlarca mesaja hızlı cevap verebilmesi için hazır şablonlar.
export const REPLY_TEMPLATES: { label: string; text: string }[] = [
  { label: "Teşekkür", text: "Mesajınız için teşekkür ederiz. En kısa sürede size dönüş yapacağız. 🌸" },
  { label: "Kargo bilgisi", text: "Siparişiniz hazırlanıyor. Kargoya verildiğinde takip numarası e-posta adresinize iletilecektir." },
  { label: "Stok var", text: "İlgili ürün stoklarımızda mevcuttur, güvenle sipariş verebilirsiniz." },
  { label: "İade/değişim", text: "İade ve değişim talepleriniz için ürünü teslim aldıktan sonra 14 gün içinde iade edebilirsiniz. Yardımcı olmamızı ister misiniz?" },
  { label: "Beden/renk", text: "Tüm beden ve renk seçenekleri ürün sayfasında yer almaktadır. Dilerseniz size özel öneride bulunabilirim." },
  { label: "Özür", text: "Yaşadığınız olumsuzluk için içtenlikle özür dileriz. Sorunu en kısa sürede çözmek için elimizden geleni yapacağız." },
];
