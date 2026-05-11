import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { BacktestStrategy } from "../../../generated/prisma/enums.js";

export async function createBacktestRun(data: {
  userId: string;
  assetId: string;
  strategy: BacktestStrategy;
  initialCapital: Prisma.Decimal;
  periodStart: Date;
  periodEnd: Date;
  fastPeriod: number;
  slowPeriod: number;
  summary: Prisma.InputJsonValue;
  series: Prisma.InputJsonValue;
}) {
  return prisma.backtestRun.create({ data });
}

export async function listBacktestsByUserId(userId: string) {
  return prisma.backtestRun.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      assetId: true,
      strategy: true,
      initialCapital: true,
      periodStart: true,
      periodEnd: true,
      fastPeriod: true,
      slowPeriod: true,
      summary: true,
      createdAt: true,
    },
  });
}

export async function findBacktestByIdForUser(id: string, userId: string) {
  return prisma.backtestRun.findFirst({
    where: { id, userId },
  });
}
