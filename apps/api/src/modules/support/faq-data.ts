// Yardım & Destek sayfasındaki hazır soru-cevap kutuları - admin panelden
// yönetilecek kadar sık değişmiyor, kod içinde sabit tutuluyor (bkz.
// kullanıcı isteği: "hızlı sorular ve cevaplar olsun").
export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: FaqEntry[] = [
  {
    id: "kargo-suresi",
    question: "Siparişim ne zaman kargoya verilir?",
    answer: "Satıcı, siparişinizi onayladıktan sonra genellikle 1-3 iş günü içinde kargoya verir. Kargoya verildiğinde takip numarası e-posta adresinize iletilir.",
  },
  {
    id: "iade-sureci",
    question: "Ürünümü nasıl iade ederim?",
    answer: "Ürünü teslim aldıktan sonra 14 gün içinde koşulsuz iade hakkınız vardır. Sipariş Takip sayfasından iade talebi oluşturabilir veya info@gulumsalim.com adresine yazabilirsiniz.",
  },
  {
    id: "odeme-yontemleri",
    question: "Hangi ödeme yöntemlerini kullanabilirim?",
    answer: "Tüm ödemeler iyzico altyapısı üzerinden 256-bit SSL ile güvenli şekilde kredi/banka kartıyla alınır.",
  },
  {
    id: "satici-olma",
    question: "Nasıl satıcı olabilirim?",
    answer: "Üst menüdeki veya Hakkımızda sayfasındaki \"Satıcı Ol\" butonuna tıklayıp başvuru formunu doldurmanız yeterli. Başvurunuz incelendikten sonra size dönüş yapılır.",
  },
  {
    id: "siparis-takip",
    question: "Siparişimi nasıl takip ederim?",
    answer: "Hesabım > Siparişlerim bölümünden ya da site üstündeki \"Sipariş Takip\" bağlantısından sipariş durumunuzu görebilirsiniz.",
  },
  {
    id: "kupon-kullanimi",
    question: "Kupon kodumu nasıl kullanırım?",
    answer: "Sepet sayfasındaki \"Kupon Kodu\" alanına kodunuzu girip uygulayabilirsiniz; indirim tutarı toplam üzerinden otomatik hesaplanır.",
  },
  {
    id: "birden-fazla-satici",
    question: "Sepetimde farklı mağazalardan ürün varsa ne olur?",
    answer: "Her mağazanın ürünleri kendi siparişi olarak ayrı ayrı oluşturulur ve ayrı kargolanır; ödemeyi tek seferde yaparsınız.",
  },
  {
    id: "iletisim",
    question: "Size nasıl ulaşabilirim?",
    answer: "Bu sayfadaki sohbet kutusuna yazabilir ya da İletişim sayfasındaki formu kullanabilirsiniz.",
  },
];
