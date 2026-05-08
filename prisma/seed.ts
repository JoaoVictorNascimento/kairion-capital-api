import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { AssetType } from "../src/generated/prisma/enums.js";

async function main() {
  const assets = [
    {
      symbol: "PETR4",
      exchange: "B3",
      name: "Petrobras PN",
      type: AssetType.STOCK,
      currency: "BRL",
    },
    {
      symbol: "VALE3",
      exchange: "B3",
      name: "Vale ON",
      type: AssetType.STOCK,
      currency: "BRL",
    },
    {
      symbol: "AAPL",
      exchange: "NASDAQ",
      name: "Apple Inc.",
      type: AssetType.STOCK,
      currency: "USD",
    },
    {
      symbol: "BTC",
      exchange: "BINANCE",
      name: "Bitcoin",
      type: AssetType.CRYPTO,
      currency: "USD",
    },
  ];

  for (const a of assets) {
    await prisma.asset.upsert({
      where: {
        symbol_exchange: {
          symbol: a.symbol,
          exchange: a.exchange,
        },
      },
      create: a,
      update: {
        name: a.name,
        type: a.type,
        currency: a.currency,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

