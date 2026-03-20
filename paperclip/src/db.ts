import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "fs";
import { dirname } from "path";
import * as schema from "./schema/index.js";

export function createDb(dbPath: string) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);

  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export type AppDb = ReturnType<typeof createDb>["db"];
