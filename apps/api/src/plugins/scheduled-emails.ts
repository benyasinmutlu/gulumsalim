import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import cron from "node-cron";
import { sendCartAbandonmentReminders, sendFavoritesDigest } from "../modules/notifications/scheduled-emails.service";

// bkz. kullanıcı isteği: "sepetteki ürünleri hatırlatma ve favoriler ...
// gibi mailler gönderelim" - ayrı bir cron/worker süreci kurmak yerine
// API zaten sürekli çalışan tek bir süreç olduğu için (systemd servisi)
// node-cron ile aynı process içinde zamanlanıyor. Sunucu saat dilimi
// TRT/UTC ayrımı önemli değil - saatler gece geç saatlere denk gelecek
// şekilde seçildi (kullanıcı trafiğini etkilemez).
const scheduledEmailsPlugin: FastifyPluginAsync = async (app) => {
  // Her gün 09:00 - sepette ürün bırakıp tamamlamayan müşterilere hatırlatma.
  cron.schedule("0 9 * * *", () => {
    sendCartAbandonmentReminders(app.redis, app.log).catch((err) => app.log.error({ err }, "Sepet hatırlatma job'ı başarısız oldu"));
  });

  // Her Pazartesi 10:00 - favorilerdeki ürünler için haftalık hatırlatma.
  cron.schedule("0 10 * * 1", () => {
    sendFavoritesDigest(app.log).catch((err) => app.log.error({ err }, "Favoriler digest job'ı başarısız oldu"));
  });
};

export default fp(scheduledEmailsPlugin, { name: "scheduled-emails", dependencies: ["redis"] });
