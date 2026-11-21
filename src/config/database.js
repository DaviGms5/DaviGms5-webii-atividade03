import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

// ADICIONADO (aula 12): a Vercel compila o cliente gerado de .ts para .js e não publica os .ts.
// Localmente (Node, tsx e Vitest) o arquivo é client.ts; no deploy, só existe client.js.
const { PrismaClient } = await import("../../generated/prisma/client.ts").catch(
  (error) => {
    if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    return import("../../generated/prisma/client.js");
  },
);

const isDevelopment = process.env.NODE_ENV !== "production";
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter,
  log: isDevelopment ? ["query", "warn", "error"] : ["warn", "error"],
});

export default prisma;
