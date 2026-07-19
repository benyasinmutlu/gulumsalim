import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";
import { Redis } from "ioredis";
import { env } from "../config/env";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (app) => {
  const redis = new Redis(env.REDIS_URL);
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    await redis.quit();
  });
};

export default fp(redisPlugin, { name: "redis" });
