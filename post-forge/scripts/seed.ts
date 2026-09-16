/**
 * Seed / demo data script — wired up in T17 (depends on T02's data model
 * and T03's persistence tools). Placeholder so `npm run seed` resolves.
 */
async function main() {
  console.log("[seed] no-op placeholder — seeding is implemented in T17.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
