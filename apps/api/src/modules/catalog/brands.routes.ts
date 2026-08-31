import { FastifyPluginAsync } from "fastify";
import { listActiveBrandNames } from "../admin/admin-brands.repository";

// bkz. denetim raporu: "Marka yönetimi" - satıcı ürün formundaki Marka
// alanı için admin onaylı marka önerileri (datalist), herkese açık/kimlik
// gerektirmez (satıcı paneli client component'i bunu çağırır).
const brandsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/brands", async (_request, reply) => {
    return reply.send(await listActiveBrandNames());
  });
};

export default brandsRoutes;
