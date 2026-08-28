import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

function databaseUrl() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required to connect to HealthHome's database.");
  }

  return url;
}

const globalForDatabase = globalThis as typeof globalThis & {
  healthHomePool?: Pool;
};

const pool =
  globalForDatabase.healthHomePool ??
  new Pool({
    connectionString: databaseUrl(),
    max: 1,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.healthHomePool = pool;
}

export const db = drizzle({ client: pool });

export async function checkDatabaseConnection() {
  await pool.query("select 1");
}
