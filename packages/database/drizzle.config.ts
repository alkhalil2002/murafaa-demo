import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  casing: "snake_case",
  dbCredentials: {
    url:
      process.env.MIGRATION_DATABASE_URL ?? "postgres://murafaa:murafaa@localhost:5440/murafaa_dev",
  },
});
