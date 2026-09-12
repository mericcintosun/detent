import {
  approveBothOfficers,
  editOneDigit,
  executeApprovedPlan,
  fillCouponPlan,
  lockPlan,
  openConsole,
  refusal,
  sendEditedPlan,
  walkDemo,
} from "./console";
import { expect, readMode, test } from "./fixtures";

test.describe("README seven step demo", () => {
  test("an approved plan signs while a one digit edit of it is refused", async ({
    page,
  }) => {
    await test.step("1. the register loads", () => openConsole(page));
    await test.step("2. the coupon plan fills with held rows and reasons", () =>
      fillCouponPlan(page));
    await test.step("3. both officers approve", () =>
      approveBothOfficers(page));
    await test.step("4. the lock compiles a policy over DENY", () =>
      lockPlan(page));
    await test.step("5. one amount is edited", () => editOneDigit(page));
    await test.step("6. the edited plan is refused with condition and offset", () =>
      sendEditedPlan(page));
    await test.step("7. the untouched plan signs and the policy is revoked", () =>
      executeApprovedPlan(page));
  });

  test("a refusal names the engine that decided it", async ({ page }) => {
    await openConsole(page);
    const mode = await readMode(page);
    await fillCouponPlan(page);
    await approveBothOfficers(page);
    await lockPlan(page);
    await editOneDigit(page);
    await sendEditedPlan(page);

    const engine = page
      .locator("#send")
      .getByText(/^refused by: (local policy mirror|privy wallet)$/);
    await expect(engine).toBeVisible();
    if (!mode.liveSigner) {
      await expect(engine).toHaveText("refused by: local policy mirror");
      await expect(refusal(page)).toContainText(
        "Refused by the local mirror of the same policy evaluator",
      );
    }
  });

  test("a keyless send is marked synthetic and never linked to an explorer", async ({
    page,
  }) => {
    await openConsole(page);
    test.skip(
      (await readMode(page)).liveSigner,
      "a live Privy signer returns an on-chain receipt",
    );
    await fillCouponPlan(page);
    await approveBothOfficers(page);
    await lockPlan(page);
    await executeApprovedPlan(page);

    const send = page.locator("#send");
    await expect(
      send.getByText("Signed, nothing broadcast", { exact: true }),
    ).toBeVisible();
    await expect(
      send.getByText("Synthetic receipt, nothing on chain", { exact: true }),
    ).toBeVisible();
    await expect(send.getByText(/^Reference\s*0x[0-9a-f]{64}$/)).toBeVisible();
    await expect(send.locator('a[href*="hashscan"]')).toHaveCount(0);
    await expect(send.getByRole("link", { name: /HashScan/ })).toHaveCount(0);
    await expect(
      page.locator("#ledger").getByRole("link", { name: /HashScan/ }),
    ).toHaveCount(0);
  });

  test.fixme("the audit record only claims a revocation the server reported", async ({
    page,
  }) => {
    // Bug: the keyless audit entry says "Policy ... revoked" while the server returns policyRevoked false.
    await openConsole(page);
    test.skip((await readMode(page)).liveSigner, "a live signer revokes");
    await fillCouponPlan(page);
    await approveBothOfficers(page);
    await lockPlan(page);
    await executeApprovedPlan(page);

    const entry = page
      .locator("#ledger li")
      .filter({ hasText: "Signed, nothing broadcast" });
    await expect(entry).toBeVisible();
    await expect(entry).not.toContainText(/Policy \S+ revoked/);
  });

  test("explorer links only point at values read on chain", async ({
    page,
  }) => {
    await walkDemo(page);
    const links = page.locator('a[href*="hashscan"]');

    if ((await readMode(page)).seedRegister) {
      // Seed addresses and synthetic receipts do not exist on chain, so a
      // HashScan link anywhere on the page would be a claim nothing backs.
      await expect(links).toHaveCount(0);
      return;
    }

    for (const href of await links.evaluateAll((anchors) =>
      anchors.map((anchor) => anchor.getAttribute("href") ?? ""),
    )) {
      expect(href).toMatch(
        /^https:\/\/hashscan\.io\/testnet\/(contract|transaction)\/0x[0-9a-fA-F]+$/,
      );
    }
  });
});

test.describe("court ordered forced transfer", () => {
  test("the second corporate action builds a plan that can be locked", async ({
    page,
  }) => {
    await openConsole(page);
    const action = page.getByRole("button", {
      name: "Court ordered forced transfer",
      exact: true,
    });
    await action.click();
    await expect(action).toHaveAttribute("aria-pressed", "true");

    const table = page.getByRole("region", {
      name: /^Court ordered forced transfer, \d+ rows$/,
    });
    await expect(table).toBeVisible();
    await expect(page.getByText("Units moved", { exact: true })).toBeVisible();
    if ((await readMode(page)).seedRegister) {
      await expect(table).toHaveAccessibleName(
        "Court ordered forced transfer, 1 rows",
      );
    }

    await approveBothOfficers(page);
    await lockPlan(page);
    await expect(
      page
        .locator("#send")
        .getByRole("button", { name: "Execute the approved plan" }),
    ).toBeEnabled();
  });
});
