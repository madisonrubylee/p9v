import { expect, test } from "@playwright/test";

// Optional browser-side measurement of Largest Contentful Paint for both routes.
// Requires the app to be running (see playwright.config.ts webServer) and
// Playwright browsers installed: `pnpm dlx playwright install chromium`.

async function lcp(page: import("@playwright/test").Page, path: string) {
  await page.goto(path, { waitUntil: "load" });
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          resolve(last.renderTime ?? last.loadTime ?? last.startTime);
        }).observe({ type: "largest-contentful-paint", buffered: true });
        setTimeout(() => resolve(0), 5000);
      }),
  );
}

test("p9v LCP beats the vanilla waterfall", async ({ page }) => {
  const vanilla = await lcp(page, "/vanilla/u1");
  const p9v = await lcp(page, "/p9v/u1");
  console.log(`LCP — vanilla: ${Math.round(vanilla)}ms, p9v: ${Math.round(p9v)}ms`);
  expect(p9v).toBeLessThan(vanilla);
});

test("Devtools shows the p9v server prefetch as parallel", async ({ page }) => {
  await page.goto("/p9v/u1", { waitUntil: "load" });
  await page.getByRole("button", { name: "Open p9v Devtools" }).click();

  await expect(
    page.getByRole("option", { name: "Server · user-page · 3 queries" }),
  ).toHaveCount(1);
  await expect(
    page.getByText("No suspected waterfall in this session"),
  ).toBeVisible();
});

test("Devtools shows the nested client query waterfall", async ({ page }) => {
  await page.goto("/client-waterfall/u1", { waitUntil: "load" });
  await page.getByText("Recent posts").waitFor();
  await page.getByRole("button", { name: "Open p9v Devtools" }).click();

  await expect(page.getByText("Suspected waterfall · depth 3")).toBeVisible();
  await expect(page.getByTitle("client-demo-user")).toBeVisible();
  await expect(page.getByTitle("client-demo-stats")).toBeVisible();
  await expect(page.getByTitle("client-demo-posts")).toBeVisible();
});
