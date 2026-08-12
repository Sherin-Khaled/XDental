import "dotenv/config";

import { prisma } from "../config/db.js";
import {
  deleteUsersAndOwnedData,
  findTestUsers,
  previewUserOwnedData,
} from "../services/testDataCleanup.service.js";

const args = new Set(process.argv.slice(2));
const allowedArgs = new Set(["--apply", "--dry-run"]);
const unknownArgs = [...args].filter((arg) => !allowedArgs.has(arg));

function printCounts(title, counts) {
  console.log(title);
  for (const [type, count] of Object.entries(counts)) {
    console.log(`  ${type}: ${count}`);
  }
}

async function run() {
  if (unknownArgs.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  }
  if (args.has("--apply") && args.has("--dry-run")) {
    throw new Error("Use either --apply or --dry-run, not both.");
  }

  const apply = args.has("--apply");
  const [totalUsers, matchedUsers] = await Promise.all([
    prisma.user.count(),
    findTestUsers(prisma),
  ]);
  const userIds = matchedUsers.map(({ id }) => id);
  const preview = await previewUserOwnedData(prisma, userIds);

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Users matched: ${matchedUsers.length}`);
  for (const user of matchedUsers) {
    console.log(`  ${user.name} <${user.email}> [${user.id}]`);
    console.log(`    ${user.reasons.join("; ")}`);
  }
  console.log(`Users kept: ${totalUsers - matchedUsers.length}`);
  printCounts("Records matched by type:", preview);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to delete these records.");
    return;
  }

  const deleted = await deleteUsersAndOwnedData(prisma, userIds);
  printCounts("Records deleted by type:", deleted);
  console.log(`Users kept: ${totalUsers - deleted.users}`);
}

try {
  await run();
} catch (error) {
  console.error(`Cleanup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect().catch(() => {});
}
