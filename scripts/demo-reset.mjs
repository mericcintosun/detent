// npm run demo:reset
//
// Puts the console back to the state the demo opens in, and says out loud what
// it cannot put back. Plain Node ESM, no dependencies, no network, no clock and
// no randomness: run it twice and the report file is byte for byte identical.
//
// What it does: re-runs the fixture assertions npm run seed makes (12 holders,
// 3 held, unique addresses, positive balances), rewrites
// fixtures/register.seed.report.json, and prints the start state the operator
// should see on the first screen.
//
// What it deliberately does NOT do: reset the on chain anchors. PlanAnchor has
// no reset entrypoint by design, and a plan hash is deterministic, so the same
// coupon run produces the same hash on every rehearsal. That is safe rather
// than awkward: lib/anchor.ts reads planOf before it writes, so a repeated run
// reuses the existing record, sends nothing, and the audience sees the same
// screen with the same links.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = join(root, "fixtures", "register.seed.json");
const reportPath = join(root, "fixtures", "register.seed.report.json");

const EXPECTED_HOLDERS = 12;
const EXPECTED_HELD = 3;
const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/;

const failures = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

let seed;
try {
  seed = JSON.parse(readFileSync(seedPath, "utf8"));
} catch (error) {
  console.error(`demo:reset: could not read ${seedPath}`);
  console.error(`demo:reset: ${error.message}`);
  process.exit(1);
}

const holders = Array.isArray(seed.holders) ? seed.holders : null;
if (holders === null) {
  console.error(
    "demo:reset: fixtures/register.seed.json has no holders array.",
  );
  process.exit(1);
}

check(
  holders.length === EXPECTED_HOLDERS,
  `expected ${EXPECTED_HOLDERS} holders, found ${holders.length}`,
);

holders.forEach((holder, index) => {
  const expectedId = `h-${String(index + 1).padStart(2, "0")}`;
  check(
    holder.id === expectedId,
    `holder at position ${index} has id ${String(holder.id)}, expected ${expectedId}`,
  );
  check(
    typeof holder.address === "string" && ADDRESS_PATTERN.test(holder.address),
    `holder ${String(holder.id)} has address ${String(holder.address)}, expected lowercase 0x plus 40 hex characters`,
  );
  check(
    Number.isInteger(holder.balance) && holder.balance > 0,
    `holder ${String(holder.id)} has balance ${String(holder.balance)}, expected a positive integer`,
  );
});

const addresses = new Set(holders.map((holder) => holder.address));
check(
  addresses.size === holders.length,
  `addresses are not unique: ${holders.length} holders, ${addresses.size} distinct addresses`,
);

const held = holders.filter((holder) => holder.compliance !== "clear");
check(
  held.length === EXPECTED_HELD,
  `expected ${EXPECTED_HELD} holders outside the clear state, found ${held.length}`,
);

if (failures.length > 0) {
  console.error(
    "demo:reset: the register fixture is not valid, so the demo would not open cleanly.",
  );
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

/** Key-sorted JSON so the digest depends on values, never on key order. */
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

const report = {
  fixture: "fixtures/register.seed.json",
  holderCount: holders.length,
  heldCount: held.length,
  sortedIds: holders.map((holder) => holder.id).sort(),
  totalBalance: holders.reduce((total, holder) => total + holder.balance, 0),
  sha256: createHash("sha256")
    .update(JSON.stringify(canonical({ holders })))
    .digest("hex"),
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log("demo:reset: fixtures/register.seed.report.json rewritten.");
console.log("");
console.log("The console starts here:");
console.log(
  `  register       ${report.holderCount} holders on partition CLASS-A`,
);
console.log(
  `  compliance     ${report.heldCount} rows held, which is what turns them oxide red`,
);
console.log(
  "  policies       none, the in memory vault starts empty in a fresh process",
);
console.log("  audit record   empty until the first lock");
console.log("");
console.log("Not reset, on purpose:");
console.log(
  "  the on chain anchors. PlanAnchor has no reset entrypoint and a plan",
);
console.log(
  "  hash is permanent, so a rehearsed run re-anchors nothing. lib/anchor.ts",
);
console.log(
  "  reads planOf before it writes, reuses the record it finds, and the",
);
console.log("  screen looks the same as the first time.");
console.log("");
console.log("Next: npm run seed, then npm run dev and walk DEMO.md.");
