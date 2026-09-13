import { expect, test } from "./fixtures";

const NOT_FOUND_HEADING = "There is no page here";

test.describe("record and not found routes", () => {
  // Chrome logs every 404 document as a console error. On these routes the 404
  // is the expected answer, so that one message is allowed and nothing else.
  test.use({
    allowedConsoleErrors: [
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
    ],
  });

  test("the record page renders for a well formed plan hash", async ({
    page,
  }) => {
    const planHash = `0x${"ab".repeat(32)}`;
    const response = await page.goto(`/record/${planHash}`);
    expect(response?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { level: 1, name: "On chain plan record" }),
    ).toBeVisible();
    await expect(page.getByText(planHash, { exact: false })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to the audit record" }),
    ).toBeVisible();
  });

  test("a malformed plan hash is served the not found page", async ({
    request,
  }) => {
    for (const malformed of ["0x1234", "nothex"]) {
      const response = await request.get(`/record/${malformed}`);
      expect(response.status()).toBeLessThan(500);
      const html = await response.text();
      expect(html).toContain(NOT_FOUND_HEADING);
      expect(html).not.toContain(
        "This is the durable half of the audit record",
      );
    }
  });

  test("a malformed plan hash renders the not found page without a React error", async ({
    page,
  }) => {
    // Bug: notFound() streams inside the record loading.tsx boundary and intermittently throws React error #419 on hydration.
    for (const malformed of ["0x1234", "nothex"]) {
      await page.goto(`/record/${malformed}`);
      await expect(
        page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING }),
      ).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "On chain plan record" }),
      ).toHaveCount(0);
    }
  });

  test("a malformed plan hash answers with HTTP 404", async ({ page }) => {
    // Bug: record route returns 200 for a malformed hash, see coordinator fix.
    for (const malformed of ["0x1234", "nothex"]) {
      const response = await page.goto(`/record/${malformed}`);
      expect(response?.status()).toBe(404);
    }
  });

  test("an unknown route renders the not found page", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: NOT_FOUND_HEADING }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Back to the console" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Detent" }),
    ).toBeVisible();
  });
});

test.describe("app shell", () => {
  // These run on the not found page, where the 404 document is the expected
  // answer, so that one console message is allowed and nothing else.
  test.use({
    allowedConsoleErrors: [
      /^Failed to load resource: the server responded with a status of 404 \(Not Found\)$/,
    ],
  });

  test("the skip link is the first tab stop and moves focus to main", async ({
    page,
  }) => {
    await page.goto("/no-such-page");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("main#main")).toBeFocused();
  });

  test("the command palette refuses a malformed plan hash and opens a valid one", async ({
    page,
  }) => {
    await page.goto("/no-such-page");
    const palette = page.getByRole("dialog", { name: "Command palette" });
    // The shortcut listener attaches on hydration, which can trail the load
    // event under four parallel workers, so the key is pressed until it lands.
    await expect(async () => {
      // Never press while it is open: the shortcut toggles, so a slow chunk
      // would otherwise close the palette the previous press opened.
      if (!(await palette.isVisible())) await page.keyboard.press("Control+k");
      await expect(palette).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await expect(palette.getByRole("combobox")).toBeFocused();

    await palette
      .getByRole("option", { name: "Open a record by plan hash" })
      .click();
    const field = palette.getByLabel("Plan hash");
    await field.fill("0x1234");
    await field.press("Enter");
    await expect(palette.getByRole("alert")).toContainText(
      "64 hexadecimal characters after 0x; this one has 4",
    );
    await expect(field).toHaveAttribute("aria-invalid", "true");

    const planHash = `0x${"ab".repeat(32)}`;
    await field.fill(planHash);
    await field.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/record/${planHash}$`));
    await expect(
      page.getByRole("heading", { level: 1, name: "On chain plan record" }),
    ).toBeVisible();
    await expect(palette).toBeHidden();
  });

  test("the primary navigation is in the rail on desktop and in a sheet on a phone", async ({
    page,
  }) => {
    await page.goto("/no-such-page");
    const width = page.viewportSize()?.width ?? 0;
    if (width >= 1024) {
      const primary = page.getByRole("navigation", { name: "Primary" });
      await expect(
        primary.getByRole("link", { name: "Console" }),
      ).toBeVisible();
      await expect(
        primary.getByRole("link", { name: "Console" }),
      ).not.toHaveAttribute("aria-current", "page");
      return;
    }
    const menu = page.getByRole("button", { name: "Open the menu" });
    await menu.click();
    const sheet = page.getByRole("dialog", { name: "Menu" });
    await expect(sheet).toBeVisible();
    await expect(
      sheet.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(menu).toBeFocused();
  });
});
