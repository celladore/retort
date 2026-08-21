// Reusable e2e coverage for the static apps/marketing/index.html landing page.
// No dev server required — navigates directly to the file on disk.
import { test, expect } from '@playwright/test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LANDING_PAGE = pathToFileURL(path.resolve(__dirname, '../apps/marketing/index.html')).href;

const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Strings that were factually wrong in the originally delivered mockup and
// were corrected before shipping (see PR #616). Keeping this list as a
// regression guard so a future edit can't silently reintroduce them.
const FORBIDDEN_STRINGS = [
  'npx retort',
  '.retort/',
  'retort-check.yml',
  '.well-known/agent-card.json',
  '.vscode/tasks.json',
];

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(LANDING_PAGE);
});

test('loads with the expected title and hero heading', async ({ page }) => {
  await expect(page).toHaveTitle(/retort/i);
  const hero = page.getByRole('heading', { level: 1 });
  await expect(hero).toBeVisible();
  await expect(hero).toContainText('One YAML spec', { ignoreCase: true });
});

test('does not contain any of the corrected factual inaccuracies', async ({ page }) => {
  const bodyText = await page.locator('body').innerText();
  for (const forbidden of FORBIDDEN_STRINGS) {
    expect(bodyText, `page text should not contain "${forbidden}"`).not.toContain(forbidden);
  }
  // Bare `.mcp.json` is a distinct check from the real `.mcp/servers.json` and
  // `.mcp/a2a-config.json` paths the page legitimately references — a plain
  // substring match on ".mcp.json" would never appear as a substring of
  // ".mcp/servers.json", so this is safe as its own assertion.
  expect(bodyText).not.toContain('.mcp.json');
});

test('all github.com links point at the real repo, not a placeholder', async ({ page }) => {
  const githubLinks = page.locator('a[href*="github.com"]');
  const count = await githubLinks.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const href = await githubLinks.nth(i).getAttribute('href');
    expect(href).toMatch(/^https:\/\/github\.com\/phoenixvc\/retort/);
  }
  // No leftover placeholder anchors anywhere on the page.
  const placeholderLinks = await page.locator('a[href="#"]').count();
  expect(placeholderLinks).toBe(0);
});

test('theme toggle switches data-theme and aria-pressed both ways', async ({ page }) => {
  const toggle = page.locator('#theme-toggle');
  const body = page.locator('body');

  // Inline theme script runs on load — assert with retrying matchers rather
  // than a bare attribute read immediately after goto().
  await expect(body).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');

  await toggle.click();
  await expect(body).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-pressed', 'true');

  await toggle.click();
  await expect(body).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
});

test('captures light and dark full-page screenshots as visual evidence', async ({
  page,
}, testInfo) => {
  // Force a clean light-mode start regardless of any persisted preference
  // from another test in this worker (avoids cross-test localStorage leakage).
  await page.evaluate(() => localStorage.removeItem('retort-theme'));
  await page.reload();

  const body = page.locator('body');
  await expect(body).toHaveAttribute('data-theme', 'light');

  const lightPath = path.join(SCREENSHOT_DIR, 'marketing-landing-light.png');
  await page.screenshot({ path: lightPath, fullPage: true });
  await testInfo.attach('marketing-landing-light', {
    path: lightPath,
    contentType: 'image/png',
  });

  await page.locator('#theme-toggle').click();
  await expect(body).toHaveAttribute('data-theme', 'dark');

  const darkPath = path.join(SCREENSHOT_DIR, 'marketing-landing-dark.png');
  await page.screenshot({ path: darkPath, fullPage: true });
  await testInfo.attach('marketing-landing-dark', {
    path: darkPath,
    contentType: 'image/png',
  });

  expect(fs.existsSync(lightPath)).toBe(true);
  expect(fs.existsSync(darkPath)).toBe(true);
});
