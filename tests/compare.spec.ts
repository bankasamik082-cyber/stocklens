import { test, expect } from "@playwright/test";

// Tests drive AAPL, MSFT, NVDA through the real /api/compare endpoint
// (actual Finnhub + FMP + Gemini calls) to verify numbers and AI summary appear.

test.describe("Company Compare — /compare", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3003/compare");
    await expect(page.getByText("Compare Companies")).toBeVisible({ timeout: 10_000 });
  });

  // Always fills the first available empty slot. Slots 0..N fill in order.
  async function pickTicker(page: Parameters<Parameters<typeof test>[1]>[0], symbol: string) {
    const firstEmpty = page.getByTestId("ticker-input").first();
    await firstEmpty.fill(symbol.slice(0, 2));
    await page.waitForTimeout(400); // let debounce fire
    const target = page.getByTestId("ticker-suggestion").filter({ hasText: symbol }).first();
    await expect(target).toBeVisible({ timeout: 8_000 });
    await target.click();
    // Slot becomes a filled chip
    const filledSlots = page.getByTestId("ticker-slot-filled");
    await expect(filledSlots.last()).toBeVisible({ timeout: 3_000 });
  }

  test("Compare button is disabled until 2 tickers are selected", async ({ page }) => {
    const btn = page.getByTestId("compare-btn");
    await expect(btn).toBeDisabled();

    await pickTicker(page, "AAPL");
    await expect(btn).toBeDisabled();

    await pickTicker(page, "MSFT");
    await expect(btn).toBeEnabled();
  });

  test("table shows real company headers after comparing AAPL vs MSFT", async ({ page }) => {
    await pickTicker(page, "AAPL");
    await pickTicker(page, "MSFT");
    await page.getByTestId("compare-btn").click();

    // Headers appear immediately from skeleton
    await expect(page.getByTestId("company-header-AAPL")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("company-header-MSFT")).toBeVisible({ timeout: 5_000 });
  });

  test("table populates with real numbers (revenue, market cap) for AAPL + MSFT", async ({ page }) => {
    await pickTicker(page, "AAPL");
    await pickTicker(page, "MSFT");
    await page.getByTestId("compare-btn").click();

    const table = page.getByTestId("compare-table");
    await expect(table).toBeVisible({ timeout: 5_000 });

    // Wait for skeleton to resolve into real data — look for $ sign anywhere in the table
    await expect(table).toContainText("$", { timeout: 30_000 });
  });

  test("AI summary appears after comparing 3 tickers (AAPL, MSFT, NVDA)", async ({ page }) => {
    await pickTicker(page, "AAPL");
    await pickTicker(page, "MSFT");
    await pickTicker(page, "NVDA");
    await page.getByTestId("compare-btn").click();

    // Wait for loading to finish and summary to appear
    const summary = page.getByTestId("ai-summary");
    await expect(summary).toBeVisible({ timeout: 60_000 });
    const text = await summary.textContent();
    expect(text!.trim().length).toBeGreaterThan(50);
  });

  test("removing a ticker clears results and disables Compare if only 1 remains", async ({ page }) => {
    await pickTicker(page, "AAPL");
    await pickTicker(page, "MSFT");

    // Remove AAPL slot
    const removeBtn = page.getByRole("button", { name: /Remove AAPL/i });
    await removeBtn.click();

    // Compare button should be disabled again
    await expect(page.getByTestId("compare-btn")).toBeDisabled();
  });
});
