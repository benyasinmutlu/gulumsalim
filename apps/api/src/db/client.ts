import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env";
import * as schema from "./schema/index";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Small pool on purpose: the target server has 3.5GB RAM total, shared
  // with Postgres itself, Redis, Meilisearch and the Go service.
  max: 10,
});

export const db = drizzle(pool, { schema });
