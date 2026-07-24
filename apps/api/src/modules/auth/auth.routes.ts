import { FastifyPluginAsync } from "fastify";
import { findCustomerById } from "./auth.repository";
import { loginSchema, registerSchema, updateProfileSchema } from "./auth.schemas";
import {
  EmailInUseError,
  InvalidCredentialsError,
  registerCustomer,
  updateProfile,
  verifyCustomerCredentials,
  WrongCurrentPasswordError,
} from "./auth.service";

function publicCustomer(c: {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
}) {
  return { id: c.id, email: c.email, fullName: c.fullName, phone: c.phone, age: c.age, heightCm: c.heightCm, weightKg: c.weightKg };
}

const authRoutes: FastifyPluginAsync = async (app) => {
  // Frontend, mutasyon isteklerinden önce bu token'ı alıp header'da geri
  // gönderir (bkz. plugins/csrf.ts). Kendisi bir mutasyon olmadığı için
  // CSRF korumasına tabi değil.
  app.get("/auth/csrf-token", async (request, reply) => {
    return reply.send({ csrfToken: await reply.generateCsrf() });
  });

  app.post("/auth/register", { preHandler: app.csrfProtection }, async (request, reply) => {
    const input = registerSchema.parse(request.body);
    try {
      const customer = await registerCustomer(input);
      await request.session.regenerate(["cart", "vendorId", "adminId"]);
      request.session.customerId = customer.id;
      return reply.status(201).send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof EmailInUseError) {
        return reply.status(409).send({ error: { message: "Bu e-posta adresi zaten kayıtlı" } });
      }
      throw err;
    }
  });

  app.post("/auth/login", { preHandler: [app.loginRateLimit, app.csrfProtection] }, async (request, reply) => {
    const input = loginSchema.parse(request.body);
    try {
      const customer = await verifyCustomerCredentials(input);
      await request.session.regenerate(["cart", "vendorId", "adminId"]);
      request.session.customerId = customer.id;
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({ error: { message: "E-posta veya şifre hatalı" } });
      }
      throw err;
    }
  });

  app.post("/auth/logout", { preHandler: app.csrfProtection }, async (request, reply) => {
    await request.session.destroy();
    return reply.send({ ok: true });
  });

  // gulumsalim.com'daki /hesabim?logout=1 bağlantısının birebir karşılığı:
  // düz bir <a href> - JS/fetch/CSRF token'a hiç bağımlı değil, tıklanınca
  // tarayıcı zaten normal bir sayfa navigasyonu yapıyor. POST+fetch tabanlı
  // sürüm bazı tarayıcı/önbellek koşullarında sessizce başarısız
  // görünebiliyordu (bkz. logout-button.tsx yorumu) - bu yüzden buton bu
  // uca yönlendiren bir linke çevrildi.
  app.get("/auth/logout", async (request, reply) => {
    await request.session.destroy();
    return reply.redirect("/");
  });

  app.get("/auth/me", { preHandler: app.requireCustomer }, async (request, reply) => {
    const customer = await findCustomerById(request.session.customerId!);
    if (!customer) {
      return reply.status(404).send({ error: { message: "Kullanıcı bulunamadı" } });
    }
    return reply.send(publicCustomer(customer));
  });

  app.patch("/auth/me", { preHandler: [app.requireCustomer, app.csrfProtection] }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body);
    try {
      const customer = await updateProfile(request.session.customerId!, input);
      return reply.send(publicCustomer(customer));
    } catch (err) {
      if (err instanceof WrongCurrentPasswordError) {
        return reply.status(400).send({ error: { message: "Mevcut şifrenizi hatalı girdiniz" } });
      }
      throw err;
    }
  });
};

export default authRoutes;
