import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"]
  });
}

export const prisma = process.env.NODE_ENV === "production" ? globalForPrisma.prisma ?? createPrismaClient() : createPrismaClient();

if (process.env.NODE_ENV === "production") {
  globalForPrisma.prisma = prisma;
}
