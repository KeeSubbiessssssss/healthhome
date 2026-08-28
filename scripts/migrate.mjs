import { existsSync } from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const { Pool } = pg;
const { loadEnvConfig } = nextEnv;
const deploymentOnly = process.argv.includes("--vercel-deployment");
const isVercelDeployment =
  process.env.VERCEL === "1" &&
  ["preview", "production"].includes(process.env.VERCEL_ENV);

if (deploymentOnly && !isVercelDeployment) {
  console.log("Skipping database migrations outside a Vercel deployment build.");
  process.exit(0);
}

loadEnvConfig(process.cwd());

const migrationsFolder = path.join(process.cwd(), "drizzle");
const migrationJournal = path.join(migrationsFolder, "meta", "_journal.json");

if (!existsSync(migrationJournal)) {
  console.log("No generated Drizzle migrations yet; skipping database migration.");
  process.exit(0);
}

const connectionString = process.env.DATABASE_URL_UNPOOLED;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is required for database migrations. Migrations must use Neon's direct connection.",
  );
}

const pool = new Pool({ connectionString, max: 1 });
const db = drizzle({ client: pool });
const migrationLock = 793_194_083;
let lockHeld = false;

try {
  await pool.query("select pg_advisory_lock($1)", [migrationLock]);
  lockHeld = true;
  await migrate(db, { migrationsFolder });
  console.log("Database migrations are up to date.");
} finally {
  if (lockHeld) {
    await pool.query("select pg_advisory_unlock($1)", [migrationLock]);
  }
  await pool.end();
}
