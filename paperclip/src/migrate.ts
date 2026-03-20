import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { createDb } from "./db.js";
import { join } from "path";

const dbPath = process.env.DATABASE_PATH || join(
  process.env.HOME || "/tmp",
  "paralegal/data/paperclip.db"
);

console.log(`[migrate] Database: ${dbPath}`);

const { db } = createDb(dbPath);

migrate(db, { migrationsFolder: join(import.meta.dir, "../migrations") });

console.log("[migrate] Migrations applied successfully.");
