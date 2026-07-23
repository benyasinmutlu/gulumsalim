import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024;

const uploadPlugin: FastifyPluginAsync = async (app) => {
  await app.register(multipart, {
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
  });
};

export default fp(uploadPlugin, { name: "upload" });
