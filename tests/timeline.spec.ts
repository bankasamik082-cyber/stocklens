import { test, expect } from "@playwright/test";

// Tests drive NVDA through the real /api/timeline endpoint
// (Twelve Data + Finnhub + FMP calls) to verify chart and event markers appear.

test.describe("Investment Timeline — /timeline", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3003/timeline");
    await expect(page.getByText("Investment Timeline")).toBeVisible({ timeout: 10_000 });
  });

  test("page loads with ticker search input", async ({ page }) => {
    await expect(page.getByTestId("timeline-ticker-input")).toBeVisible();
    await expect(page.getByTestId("timeline-load-btn")).toBeVisible();
  });

  test("NVDA preset chip loads chart with data", async ({ page }) => {
    // Click the NVDA quick-pick preset
    await page.getByRole("button", { name: "NVDA" }).click();

    // Chart section should appear
    await expect(page.getByTestId("timeline-chart-section")).toBeVisible({ timeout: 45_000 });

    // Chart section should show the ticker
    await expect(page.getByTestId("timeline-chart-section")).toContainText("NVDA");

    // Event list should appear
    await expect(page.getByTestId("timeline-event-list")).toBeVisible({ timeout: 5_000 });
  });

  test("event markers appear with real data after loading NVDA", async ({ page }) => {
    await page.getByRole("button", { name: "NVDA" }).click();

    // Wait for chart section to load
    await expect(page.getByTestId("timeline-chart-section")).toBeVisible({ timeout: 45_000 });

    // There should be at least one event dot
    const dots = page.locator("[data-testid^='event-dot-']");
    await expect(dots.first()).toBeVisible({ timeout: 10_000 });
    const count = await dots.count();
    expect(count).toBeGreaterThan(0);
  });

  test("clicking an event marker shows the detail popover", async ({ page }) => {
    await page.getByRole("button", { name: "NVDA" }).click();

    // Wait for chart to load and dots to appear
    await expect(page.getByTestId("timeline-chart-section")).toBeVisible({ timeout: 45_000 });

    const dot = page.locator("[data-testid^='event-dot-']").first();
    await expect(dot).toBeVisible({ timeout: 10_000 });
    await dot.click();

    // Popover should appear
    await expect(page.getByTestId("event-popover")).toBeVisible({ timeout: 5_000 });
    const popoverText = await page.getByTestId("event-popover").textContent();
    expect(popoverText!.trim().length).toBeGreaterThan(10);
  });

  test("event list is populated with at least one event", async ({ page }) => {
    await page.getByRole("button", { name: "NVDA" }).click();

    await expect(page.getByTestId("timeline-event-list")).toBeVisible({ timeout: 45_000 });

    // List should have content
    const listText = await page.getByTestId("timeline-event-list").textContent();
    expect(listText!.trim().length).toBeGreaterThan(20);
  });

  test("typing a ticker in the input and pressing Load shows chart", async ({ page }) => {
    const input = page.getByTestId("timeline-ticker-input");
    await input.fill("AAPL");

    await page.getByTestId("timeline-load-btn").click();

    await expect(page.getByTestId("timeline-chart-section")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId("timeline-chart-section")).toContainText("AAPL");
  });
});
