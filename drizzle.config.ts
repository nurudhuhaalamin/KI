import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  driver: "d1-http",
  schema: "./app/lib/db/schema/index.ts",
  out: "./db/migrations",
});
