// =============================================================================
// FuelEU Maritime — Prisma Seed Script
// Run: npx ts-node prisma/seed.ts   or   npm run db:seed
// Seeds the 5 canonical routes from the assignment brief.
// R001 is set as baseline (is_baseline = true).
// =============================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding FuelEU routes…");

  // Clear existing routes (safe for dev/test; remove in production)
  await prisma.route.deleteMany();

  const routes = await prisma.route.createMany({
    data: [
      {
        routeId:        "R001",
        vesselType:     "Container",
        fuelType:       "HFO",
        year:           2024,
        ghgIntensity:   91.0,
        fuelConsumption: 5000,
        distance:       12000,
        totalEmissions: 4500,
        isBaseline:     true,   // ← Only one baseline per year allowed
      },
      {
        routeId:        "R002",
        vesselType:     "BulkCarrier",
        fuelType:       "LNG",
        year:           2024,
        ghgIntensity:   88.0,
        fuelConsumption: 4800,
        distance:       11500,
        totalEmissions: 4200,
        isBaseline:     false,
      },
      {
        routeId:        "R003",
        vesselType:     "Tanker",
        fuelType:       "MGO",
        year:           2024,
        ghgIntensity:   93.5,
        fuelConsumption: 5100,
        distance:       12500,
        totalEmissions: 4700,
        isBaseline:     false,
      },
      {
        routeId:        "R004",
        vesselType:     "RoRo",
        fuelType:       "HFO",
        year:           2025,
        ghgIntensity:   89.2,
        fuelConsumption: 4900,
        distance:       11800,
        totalEmissions: 4300,
        isBaseline:     false,
      },
      {
        routeId:        "R005",
        vesselType:     "Container",
        fuelType:       "LNG",
        year:           2025,
        ghgIntensity:   90.5,
        fuelConsumption: 4950,
        distance:       11900,
        totalEmissions: 4400,
        isBaseline:     false,
      },
    ],
    skipDuplicates: true,
  });

  console.log(`✅  Seeded ${routes.count} routes.`);
  console.log("   R001 (Container/HFO/2024) set as baseline.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
