import { createHash } from "node:crypto";
import { FastifyPluginAsync } from "fastify";
import { findPublicPageBySlug } from "../content/content.repository";
import { AiNotConfiguredError, AiTemporarilyUnavailableError, createLlmClient } from "../product-intelligence/enrichment/providers/llm-client";
import { FAQ_ENTRIES } from "./faq-data";
import { supportChatSchema } from "./support.schemas";

const CHAT_RATE_LIMIT_MAX = 20;
const CHAT_RATE_LIMIT_WINDOW_SECONDS = 10 * 60;

const FALLBACK_REPLY =
  "Şu anda canlı destek asistanımıza ulaşılamıyor. Yukarıdaki sık sorulan sorulara göz atabilir ya da İletişim sayfamızdan bize yazabilirsiniz.";

// Sistem prompt'u iade-sartlari CMS sayfasının içeriğini gömer (bkz.
// content.repository.ts) - DB okuması ucuz olsa da her chat mesajında
// tekrar sorgulamamak için kısa süreli bellek içi cache yeterli.
let cachedSystemPrompt: { value: string; expiresAt: number } | null = null;

async function buildSystemPrompt(): Promise<string> {
  if (cachedSystemPrompt && cachedSystemPrompt.expiresAt > Date.now()) return cachedSystemPrompt.value;

  const returnsPage = await findPublicPageBySlug("iade-sartlari");
  const returnsText = returnsPage
    ? returnsPage.content
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 1500)
    : "Ürün tesliminden itibaren 14 gün içinde koşulsuz iade hakkı vardır.";

  const prompt = `Sen Gülüm Şalım adlı kadın modasına odaklı bir online pazaryerinin "Yardım & Destek" asistanısın.

Platform bilgileri:
- Ödeme: iyzico altyapısıyla 256-bit SSL korumalı kredi/banka kartı ödemesi yapılır.
- Kargo: Satıcı siparişi onayladıktan sonra genellikle 1-3 iş günü içinde kargoya verir. Sepette farklı mağazalardan ürün varsa her mağaza siparişi ayrı kargolanır.
- İade politikası: ${returnsText}
- Satıcı olma: /satici/kayit sayfasından başvuru yapılır.
- Sipariş takip: Hesabım > Siparişlerim bölümünden ya da /siparis-takip sayfasından takip edilir.
- Soru sorma/yorum: Ürün sayfalarından satıcıya soru sorulabilir, teslim alınan ürünler değerlendirilebilir.

Kurallar:
1. SADECE Gülüm Şalım platformu, alışveriş, kargo, iade, ödeme ve satıcı olma gibi konularda yanıt ver.
2. Belirli bir siparişin/hesabın özel durumunu (durum, tutar, kargo takip no vb.) ASLA bilmiyorsun ve UYDURMA - kullanıcıyı "Hesabım > Siparişlerim" sayfasına veya satıcıyla mesajlaşmaya yönlendir.
3. Hiçbir koşulda telefon numarası, IBAN, e-posta adresi isteme veya üretme.
4. Kısa, sıcak, Türkçe ve net cevap ver (en fazla 4-5 cümle).
5. Platformla ilgisiz bir soru sorulursa nazikçe konunun dışında olduğunu belirt ve İletişim sayfasına yönlendir.`;

  cachedSystemPrompt = { value: prompt, expiresAt: Date.now() + 5 * 60 * 1000 };
  return prompt;
}

const supportRoutes: FastifyPluginAsync = async (app) => {
  app.get("/support/faq", async (_request, reply) => {
    return reply.send(FAQ_ENTRIES);
  });

  app.post("/support/chat", async (request, reply) => {
    const input = supportChatSchema.parse(request.body);

    // IP başına basit pencere sayacı - login-rate-limit.ts'teki atomik
    // Lua deseninin aksine burada sıkı doğruluk gerekmiyor (amaç AI
    // maliyetini sınırlamak), bu yüzden INCR+EXPIRE yeterli.
    const rateKey = `support-chat-rate:${createHash("sha256").update(request.ip).digest("hex")}`;
    const attempts = await app.redis.incr(rateKey);
    if (attempts === 1) await app.redis.expire(rateKey, CHAT_RATE_LIMIT_WINDOW_SECONDS);
    if (attempts > CHAT_RATE_LIMIT_MAX) {
      return reply.status(429).send({ error: { message: "Çok fazla mesaj gönderdiniz, lütfen birkaç dakika sonra tekrar deneyin." } });
    }

    const client = createLlmClient();
    if (!client.configured()) {
      return reply.send({ reply: FALLBACK_REPLY, aiAvailable: false });
    }

    const system = await buildSystemPrompt();
    const historyText = (input.history ?? [])
      .map((h) => `${h.role === "user" ? "Kullanıcı" : "Asistan"}: ${h.content}`)
      .join("\n");
    const prompt = historyText ? `${historyText}\nKullanıcı: ${input.message}` : input.message;

    try {
      const text = await client.complete({ system, prompt, maxTokens: 300 });
      return reply.send({ reply: text, aiAvailable: true });
    } catch (err) {
      if (err instanceof AiNotConfiguredError || err instanceof AiTemporarilyUnavailableError) {
        return reply.send({ reply: FALLBACK_REPLY, aiAvailable: false });
      }
      throw err;
    }
  });
};

export default supportRoutes;
