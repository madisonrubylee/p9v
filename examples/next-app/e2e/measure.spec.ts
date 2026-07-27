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
