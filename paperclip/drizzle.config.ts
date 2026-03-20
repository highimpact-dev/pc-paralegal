import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/*",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_PATH || "./data/paperclip.db",
  },
});
