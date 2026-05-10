import { prisma } from "../../../lib/prisma.js";
import { Prisma } from "../../../generated/prisma/client.js";

const portfolioWithAssetsInclude = {
  assets: {
    include: { asset: true },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.PortfolioInclude;

export type PortfolioWithAssets = Prisma.PortfolioGetPayload<{
  include: typeof portfolioWithAssetsInclude;
}>;

export async function createPortfolio(userId: string, data: { name: string; description?: string | null }) {
  return prisma.portfolio.create({
    data: {
      userId,
      name: data.name.trim(),
      ...(data.description !== undefined && data.description !== null && data.description !== ""
        ? { description: data.description.trim() }
        : {}),
    },
  });
}

export async function listPortfoliosByUserId(userId: string) {
  return prisma.portfolio.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function findPortfolioByIdForUser(
  portfolioId: string,
  userId: string,
): Promise<PortfolioWithAssets | null> {
  return prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    include: portfolioWithAssetsInclude,
  });
}

export async function findPortfolioRowForUser(portfolioId: string, userId: string) {
  return prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
    select: { id: true },
  });
}

export async function addPortfolioAsset(data: {
  portfolioId: string;
  assetId: string;
  targetWeight: Prisma.Decimal | null;
  quantity: Prisma.Decimal | null;
}) {
  return prisma.portfolioAsset.create({
    data: {
      portfolioId: data.portfolioId,
      assetId: data.assetId,
      targetWeight: data.targetWeight,
      quantity: data.quantity,
    },
    include: { asset: true },
  });
}

export async function removePortfolioAsset(portfolioId: string, assetId: string) {
  const result = await prisma.portfolioAsset.deleteMany({
    where: { portfolioId, assetId },
  });
  return result.count;
}
