import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";

const STATE_FILE = "tests/.test-state.json";

function getReportUrl(): string {
  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  return state.reportUrl as string;
}

test.describe("AI Research Chat — /report/[id]", () => {
  let reportUrl: string;

  test.beforeAll(() => {
    reportUrl = getReportUrl();
  });

  test("chat FAB is visible on the report page", async ({ page }) => {
    await page.goto(reportUrl);
    const fab = page.getByTestId("chat-fab");
    await expect(fab).toBeVisible({ timeout: 10_000 });
  });

  test("clicking FAB opens the chat panel", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();
    const panel = page.getByTestId("chat-panel");
    await expect(panel).toBeVisible({ timeout: 5_000 });
  });

  test("data snapshot loads and greeting message appears", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();

    // Greeting appears once /api/chat/context finishes
    const greeting = page.getByTestId("assistant-message").first();
    await expect(greeting).toBeVisible({ timeout: 30_000 });
    const text = await greeting.textContent();
    expect(text).toMatch(/AAPL|data snapshot/i);
  });

  test("sends a question and receives an AI answer", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();

    // Wait for greeting = context loaded
    await expect(page.getByTestId("assistant-message").first()).toBeVisible({ timeout: 30_000 });

    // Ask a question
    await page.getByPlaceholder(/Ask about AAPL/i).fill("What is the revenue?");
    await page.keyboard.press("Enter");

    // User bubble
    await expect(page.getByTestId("user-message")).toBeVisible({ timeout: 5_000 });

    // Wait for the real AI reply (not the loading dots which have empty text)
    const answer = page.getByTestId("assistant-message").nth(1);
    await expect(answer).toHaveText(/\w{5,}/, { timeout: 45_000 });
  });

  test("AI answer includes citations from expected sources", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();

    await expect(page.getByTestId("assistant-message").first()).toBeVisible({ timeout: 30_000 });

    await page.getByPlaceholder(/Ask about AAPL/i).fill("What sector is AAPL in?");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("assistant-message").nth(1)).toBeVisible({ timeout: 45_000 });

    const sources = page.getByTestId("chat-sources").first();
    await expect(sources).toBeVisible({ timeout: 5_000 });

    const sourceText = await sources.textContent();
    expect(sourceText).toMatch(/Finnhub|FMP/);
  });

  test("multi-turn: second question gets a follow-up answer", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();

    await expect(page.getByTestId("assistant-message").first()).toBeVisible({ timeout: 30_000 });

    // Q1
    await page.getByPlaceholder(/Ask about AAPL/i).fill("What is the profit margin?");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("assistant-message").nth(1)).toBeVisible({ timeout: 45_000 });

    // Q2 follow-up
    await page.getByPlaceholder(/Ask about AAPL/i).fill("And the net income?");
    await page.keyboard.press("Enter");
    const followUp = page.getByTestId("assistant-message").nth(2);
    await expect(followUp).toHaveText(/\w{5,}/, { timeout: 45_000 });
  });

  test("panel closes when the X button is clicked", async ({ page }) => {
    await page.goto(reportUrl);
    await page.getByTestId("chat-fab").click();
    await expect(page.getByTestId("chat-panel")).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: /close chat/i }).click();
    await expect(page.getByTestId("chat-panel")).not.toBeVisible({ timeout: 3_000 });
  });
});
