import { prisma } from "../lib/prisma";
import { runNotesImport } from "../lib/import/importer";

async function main() {
  const result = await runNotesImport();
  console.log(`Import run ${result.importRunId}`);
  console.log(`Discovered ${result.filesDiscovered} files`);
  console.log(`Imported ${result.imported}, updated ${result.updated}, skipped ${result.skipped}, errored ${result.errored}`);
  console.log(`Warnings ${result.warnings}, duplicate reviews ${result.duplicateReviews}`);
  console.log(`Duration ${result.durationMs}ms`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
