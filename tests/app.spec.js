const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const NM = path.join(__dirname, '..', 'node_modules', '@vladmandic');
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.bin': 'application/octet-stream', '.wasm': 'application/wasm' };

// הספרייה והמודלים מוגשים מהעותק המקומי (node_modules) במקום מהאינטרנט — הבדיקה לא תלויה ברשת.
async function offline(page) {
  await page.route(/cdn\.jsdelivr\.net\/npm\/@vladmandic\/(human|human-models)@[^/]+\/(.*)$/, (route) => {
    const m = route.request().url().match(/@vladmandic\/(human|human-models)@[^/]+\/([^?]*)/);
    const file = path.join(NM, m[1], m[2]);
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + m[2] });
    route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
}

function collectErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

test('האפליקציה עולה בלי שגיאות והמנוע נטען', async ({ page }) => {
  const errors = collectErrors(page);
  await offline(page);
  await page.goto('/');
  await expect(page).toHaveTitle('מי בבית');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('#sText')).toContainText('מוכן', { timeout: 90_000 });
  await expect(page.locator('#startBtn')).toBeEnabled();
  expect(errors).toEqual([]);
});

test('המצלמה המדומה נדלקת ופנים מזוהות', async ({ page }) => {
  test.setTimeout(300_000); // בלי כרטיס גרפי הזיהוי איטי מאוד
  const errors = collectErrors(page);
  await offline(page);
  await page.goto('/');
  await expect(page.locator('#startBtn')).toBeEnabled({ timeout: 90_000 });
  await page.locator('#startBtn').click();
  await expect(page.locator('#sText')).toHaveText('סורק', { timeout: 30_000 });
  // פנים במעקב, ואחרי כמה פריימים נוצר אדם "לא מזוהה" שנשמר במכשיר
  await expect.poll(() => page.evaluate('tracks.length'), { timeout: 60_000 }).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate('S.people.length'), { timeout: 60_000 }).toBeGreaterThan(0);
  // זיהוי לפי מראה: הגוף משויך לפנים, והלבוש של היום נלמד
  await expect.poll(() => page.evaluate('S.people[0].look ? S.people[0].look.s.length : 0'), { timeout: 60_000 }).toBeGreaterThan(0);
  // זיהוי גוף חד: הזום על הגוף רץ, והפעילות מופיעה ברשימה
  await expect.poll(() => page.evaluate('bodies.some((b) => b.sharp)'), { timeout: 60_000 }).toBe(true);
  // "מסתובב": מפסיקים לקבל פנים — האדם נשאר מזוהה לפי הגוף, והרשימה אומרת את זה
  await page.evaluate('process = function () { tracks = []; render(); }');
  await expect.poll(() => page.evaluate('[...lookPresent().values()].join()'), { timeout: 60_000 }).toMatch(/track|look/);
  await expect(page.locator('#p-now .pmeta')).toContainText('מזוהה לפי מראה', { timeout: 30_000 });
  // בפרופיל מופיעים צבעי הלבוש שנלמדו
  await page.locator('#p-now .person').click();
  await expect(page.locator('#mLook .lookchip').first()).toBeVisible();
  await expect(page.locator('#mLook')).toContainText('מראה היום');
  expect(errors).toEqual([]);
});
