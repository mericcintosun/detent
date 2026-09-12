// npm run seed
//
// Reads fixtures/register.seed.json, asserts the invariants the demo depends on,
// and writes fixtures/register.seed.report.json with derived values only. Plain
// Node ESM, no dependencies, no clock, no randomness, no network: run it twice
// on a clean checkout and both reports are byte for byte identical.

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
  console.error(`seed: could not read ${seedPath}`);
  console.error(`seed: ${error.message}`);
  process.exit(1);
}

const holders = Array.isArray(seed.holders) ? seed.holders : null;
if (holders === null) {
  console.error("seed: fixtures/register.seed.json has no holders array.");
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
  console.error("seed: the register fixture is not valid.");
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

const sortedIds = holders.map((holder) => holder.id).sort();
const canonicalJson = JSON.stringify(canonical({ holders }));
const report = {
  fixture: "fixtures/register.seed.json",
  holderCount: holders.length,
  heldCount: held.length,
  sortedIds,
  totalBalance: holders.reduce((total, holder) => total + holder.balance, 0),
  sha256: createHash("sha256").update(canonicalJson).digest("hex"),
};

writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(
  `seed: ${report.holderCount} holders, ${report.heldCount} held, sha256 ${report.sha256}`,
);
console.log("seed: wrote fixtures/register.seed.report.json");
