import { prisma } from "../lib/db/client";

async function main() {
  const result = await prisma.$queryRaw`SELECT 1 as ok`;
  console.log("DB OK:", result);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
