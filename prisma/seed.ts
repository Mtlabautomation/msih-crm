// MSIH CRM V1.0 — Database Seed (CLI entry point)
// Developer: Manoj Dore
// Run: bun run db:seed  OR  npx tsx prisma/seed.ts
//
// The actual seed logic lives in src/lib/seed.ts so it can be imported
// by /api/setup for Vercel deployments. This file just re-exports and
// invokes it for CLI usage.

import { main } from "../src/lib/seed";
import { PrismaClient } from "@prisma/client";

// Re-export for any consumers that import from prisma/seed.ts
export { main } from "../src/lib/seed";

// Auto-run when executed directly via `npx tsx prisma/seed.ts`
if (require.main === module) {
  const db = new PrismaClient();
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await db.$disconnect();
    });
}
