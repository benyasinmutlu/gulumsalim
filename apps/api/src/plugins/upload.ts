import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";

// 50MB - kısa ürün tanıtım videolarını da kapsar. Görseller sharp ile zaten
// çok daha küçüğe indiriliyor; bu tavan esas olarak video içindir.
const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

const uploadPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  });
};

export default fp(uploadPlugin, { name: "upload" });
