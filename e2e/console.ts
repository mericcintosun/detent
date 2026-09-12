import { type Page } from "@playwright/test";
import { expect, readMode, statusLine } from "./fixtures";

// The README's seven step demo as reusable steps. Each step asserts the outcome
// the README promises, so the desktop flow, the mobile flow and the mode aware
// checks all walk the same path and fail at the same place.

const HOLD_REASON =
  /^(Allowlist entry expired|KYC refresh overdue|Sanctions screening hold)\. /;

/** The refusal banner, which is the console's assertive live region. */
export function refusal(page: Page) {
  return page.getByRole("alert").filter({ hasText: "Treasury key, refused" });
}

/** Step 1: the register loads. */
export async function openConsole(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Detent" }),
  ).toBeVisible();
  await expect(statusLine(page)).toContainText("Hedera testnet");
  await expect(statusLine(page)).toContainText("No policy locked yet");

  const summary = page.getByText(/tokens across \d+ holders on partition/);
  await expect(summary).toBeVisible();
  if ((await readMode(page)).seedRegister) {
    await expect(summary).toContainText(
      "across 12 holders on partition CLASS-A",
    );
    await expect(summary).toContainText("3 of them are currently held");
  }
}

/** Step 2: the coupon plan fills, held rows carry their reasons, headroom prints. */
export async function fillCouponPlan(page: Page) {
  await page
    .getByRole("button", { name: "Distribute quarterly coupon", exact: true })
    .click();
  const table = page.getByRole("region", {
    name: /^Distribute quarterly coupon, \d+ rows$/,
  });
  await expect(table).toBeVisible();

  if ((await readMode(page)).seedRegister) {
    await expect(table).toHaveAccessibleName(
      "Distribute quarterly coupon, 12 rows",
    );
    await expect(table.getByRole("button", { name: "Force in" })).toHaveCount(
      3,
    );
    await expect(table.getByText(HOLD_REASON)).toHaveCount(3);
  }
  await expect(page.getByText("Headroom", { exact: true })).toBeVisible();
}

/** Step 3: both officers approve, which is the key quorum of two. */
export async function approveBothOfficers(page: Page) {
  const quorum = page.locator("#policy");
  const pending = quorum.getByRole("button", { name: "Approve", exact: true });
  await expect(pending).toHaveCount(2);
  await pending.first().click();
  await expect(pending).toHaveCount(1);
  await pending.first().click();
  await expect(
    quorum.getByRole("button", { name: "Approved", exact: true }),
  ).toHaveCount(2);
  await expect(quorum.getByText("2 of 2 signatures collected.")).toBeVisible();
}

/** Step 4: the lock compiles a policy with four conditions over DENY. */
export async function lockPlan(page: Page) {
  const policy = page.locator("#policy");
  await policy
    .getByRole("button", { name: "Lock this plan to the treasury key" })
    .click();
  await expect(
    policy.getByRole("button", { name: "Plan locked to the treasury key" }),
  ).toBeDisabled();
  await expect(
    policy.getByText(/^(to|chain_id|data) (eq|starts_with)$/),
  ).toHaveCount(4);
  await expect(
    policy.getByText("default action", { exact: true }),
  ).toBeVisible();
  await expect(policy.getByText("DENY", { exact: true })).toBeVisible();
  await expect(statusLine(page)).not.toContainText("No policy locked yet");
  await expect(statusLine(page)).toContainText(/Policy \S+/);
}

/** Step 5: edit one digit of the amount in the send section. */
export async function editOneDigit(page: Page): Promise<string> {
  const amount = page.getByLabel(/^Amount for /);
  await expect(amount).toBeEnabled();
  const approved = await amount.inputValue();
  const edited = changeOneDigit(approved);
  await amount.fill(edited);
  await expect(amount).toHaveValue(edited);
  return edited;
}

/** Replaces the first digit with a different one, keeping the shape intact. */
export function changeOneDigit(value: string): string {
  const index = value.search(/\d/);
  if (index < 0) throw new Error(`no digit to edit in "${value}"`);
  const digit = Number(value[index]);
  const replacement = String(digit === 9 ? 8 : digit + 1);
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

/**
 * Step 6: sending the edited plan is refused, naming the failed condition and
 * the byte offset where the payload diverged. Returns that offset.
 */
export async function sendEditedPlan(page: Page): Promise<number> {
  await page.getByRole("button", { name: "Send edited plan" }).click();
  const banner = refusal(page);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("ethereum_transaction.data");
  await expect(banner).toContainText(/diverges at byte \d+/);
  await expect(
    page.locator("#send").getByText("Refused", { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator("#ledger").getByText("Signature refused", { exact: true }),
  ).toBeVisible();

  const text = await banner.innerText();
  const offset = Number(/diverges at byte (\d+)/.exec(text)?.[1]);
  // The first four bytes are the selector the policy also pins, so an edited
  // amount can only diverge after them.
  expect(offset).toBeGreaterThanOrEqual(4);
  return offset;
}

/**
 * Step 7: the untouched plan signs and the policy stops granting anything. With
 * a live signer the badge reports the revocation. On the keyless path nothing
 * was installed on a wallet, so the server says there is nothing to revoke and
 * the guarantee is that the lock is spent and no send can follow.
 */
export async function executeApprovedPlan(page: Page) {
  const mode = await readMode(page);
  const send = page.locator("#send");
  await send.getByRole("button", { name: "Execute the approved plan" }).click();
  await expect(
    send.getByText(/^Signed(, nothing broadcast)?$/).first(),
  ).toBeVisible();
  await expect(
    send.getByRole("button", { name: "Executed, the lock is spent" }),
  ).toBeDisabled();
  await expect(
    send.getByRole("button", { name: "Send edited plan" }),
  ).toBeDisabled();
  await expect(page.getByLabel(/^Amount for /)).toBeDisabled();

  if (mode.liveSigner) {
    await expect(
      send.getByText("Policy revoked", { exact: true }),
    ).toBeVisible();
  } else {
    await expect(
      send.getByText(/there was nothing to detach or revoke/),
    ).toBeVisible();
  }
}

/** The whole README walk, for tests that assert on its end state. */
export async function walkDemo(page: Page) {
  await openConsole(page);
  await fillCouponPlan(page);
  await approveBothOfficers(page);
  await lockPlan(page);
  await editOneDigit(page);
  await sendEditedPlan(page);
  await executeApprovedPlan(page);
}
