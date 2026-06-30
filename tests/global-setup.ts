import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

export const TEST_EMAIL = "playwright-test@stocklens-test.com";
export const TEST_PASSWORD = "PlaywrightTest2025!";
export const AUTH_FILE = "tests/.auth.json";
export const STATE_FILE = "tests/.test-state.json";

export default async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create test user (idempotent — ignore "already been registered" error)
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  let testUserId: string;
  if (createErr) {
    if (!createErr.message.includes("already been registered")) {
      throw new Error(`Failed to create test user: ${createErr.message}`);
    }
    // User exists — look them up by email
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw new Error(`Failed to list users: ${listErr.message}`);
    const existing = users.find((u) => u.email === TEST_EMAIL);
    if (!existing) throw new Error("Test user not found after creation attempt");
    testUserId = existing.id;
  } else {
    testUserId = created.user.id;
  }

  // Insert a minimal analysis row directly — the chat doesn't depend on
  // report content; it fetches fresh data from /api/chat/context.
  const minimalReport = {
    companyOverview: null,
    financialHealth: {
      revenue: "N/A",
      netIncome: "N/A",
      profitMargin: "N/A",
      debt: "N/A",
      cashFlow: "N/A",
      score: 5,
      scoreRationale: "Playwright test report",
    },
    recentNews: null,
    politicianTrading: null,
    bullCase: null,
    bearCase: null,
    finalVerdict: null,
  };

  const { data: row, error: insertErr } = await admin
    .from("analyses")
    .insert({
      user_id: testUserId,
      ticker: "AAPL",
      selected_sections: ["financialHealth"],
      generated_report: minimalReport,
      sources: { financialHealth: [] },
    })
    .select("id")
    .single();

  if (insertErr || !row) {
    throw new Error(`Failed to insert test analysis: ${insertErr?.message}`);
  }

  const reportUrl = `http://localhost:3003/report/${row.id}`;

  // Sign in via the login UI so SSR cookies are set correctly
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto("http://localhost:3003/login");
  await page.getByPlaceholder("you@example.com").fill(TEST_EMAIL);
  await page.getByPlaceholder("••••••••").fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 20_000 });

  // Save browser state (cookies + localStorage) for the test suite
  await ctx.storageState({ path: AUTH_FILE });
  await browser.close();

  // Share the report URL with the tests
  writeFileSync(STATE_FILE, JSON.stringify({ reportUrl }));
}
