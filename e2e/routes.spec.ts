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
