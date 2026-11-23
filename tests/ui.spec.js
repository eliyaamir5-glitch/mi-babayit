// מסך פתיחה, הגדרות מומלצות לפי סביבה, הגדרות בפרקים, ציר זמן, שיפור בחושך והתקנה כאפליקציה.
const { test, expect } = require('@playwright/test');
const fs = require('fs'), path = require('path');

test.beforeEach(async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
});

test('כניסה ראשונה: בוחרים סביבה, וכל ההגדרות מכוונות למומלץ — ומוצג פעם אחת', async ({ page }) => {
  await expect(page.locator('#obModal')).toHaveClass(/open/);
  await expect(page.locator('#obGrid [data-ob]')).toHaveCount(10);
  await page.locator('[data-ob="nursery"]').click();
  await page.locator('#obNext').click();
  await expect(page.locator('#obTitle2')).toContainText('חדר תינוק');
  await expect(page.locator('#obList')).toContainText('בכי');
  await expect(page.locator('#obStep2 .obsafe')).toContainText('101');
  await page.locator('#obDone').click();
  const st = await page.evaluate(() => ({ env: S.settings.env, sens: S.settings.motionSens, cry: S.settings.snd.cry.on, scream: S.settings.snd.scream.on, mic: S.settings.snd.on, soothe: S.settings.snd.soothe, db: S.settings.snd.noiseDb, ob: S.settings.onboarded }));
  expect(st).toEqual({ env: 'nursery', sens: 8, cry: true, scream: false, mic: true, soothe: true, db: 14, ob: true });
  await expect(page.locator('#envPill')).toContainText('חדר תינוק');
  await page.waitForTimeout(700); // השמירה למכשיר מושהית מעט
  await page.reload();
  await page.waitForTimeout(600);
  await expect(page.locator('#obModal')).not.toHaveClass(/open/);
  await expect(page.locator('#envPill')).toContainText('חדר תינוק');
});

test('החלפת סביבה מהכותרת: אמבטיה מפעילה פרטיות מלאה, סלון מחזיר', async ({ page }) => {
  await page.locator('#obSkip').click();
  await page.locator('#envPill').click();
  await page.locator('[data-ob="bath"]').click(); await page.locator('#obNext').click();
  await expect(page.locator('#obList')).toContainText('פרטיות');
  await page.locator('#obDone').click();
  let st = await page.evaluate(() => ({ privacy: S.settings.privacy, skel: S.settings.skeleton, clips: S.settings.clips, looks: S.settings.looks, still: envCfg().stillMult }));
  expect(st).toEqual({ privacy: true, skel: true, clips: false, looks: false, still: 0.5 });
  await page.evaluate(() => applyEnv('living'));
  st = await page.evaluate(() => ({ privacy: S.settings.privacy, skel: S.settings.skeleton, clips: S.settings.clips, looks: S.settings.looks, q: S.settings.quality }));
  expect(st).toEqual({ privacy: false, skel: false, clips: true, looks: true, q: 'balanced' });
});

test('הגדרות בפרקים: סגורים בהתחלה, נפתחים בלחיצה, וחיפוש מוצא שורה', async ({ page }) => {
  await page.locator('#obSkip').click();
  await page.locator('#setBtn').click();
  await expect(page.locator('#setModal .setsec')).toHaveCount(9);
  await expect(page.locator('#setModal .set-row:visible')).toHaveCount(0);
  await page.locator('.setsec-h', { hasText: 'שמירה ובטיחות' }).click();
  await expect(page.locator('#swLook')).toBeVisible();
  await expect(page.locator('.setsec-h', { hasText: 'שמירה ובטיחות' })).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#setSearch').fill('ברכה קולית');
  await expect(page.locator('#swVoice')).toBeVisible();
  await expect(page.locator('#swLook')).toBeHidden();
  await page.locator('#setSearch').fill('אין דבר כזה בכלל');
  await expect(page.locator('#setNone')).toBeVisible();
  await page.locator('#setSearch').fill('');
  await expect(page.locator('#swLook')).toBeVisible();   // הפרק שנפתח קודם נשאר פתוח
  await expect(page.locator('#swVoice')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('#setModal')).not.toHaveClass(/open/);
});

test('ציר הזמן של היום מציג מי היה ומתי', async ({ page }) => {
  await page.locator('#obSkip').click();
  const r = await page.evaluate(() => {
    const now = Date.now();
    S.people = [{ id: 'A', name: 'דני', samples: [], visits: 1, lastSeen: now, thumb: '' }];
    running = true; tracks = [{ pid: 'A', seen: now, box: [0, 0, 10, 10] }];
    presTick(now - 30 * 60000 > new Date().setHours(0, 0, 0, 0) ? now - 30 * 60000 : now); tracks[0].seen = Date.now(); presTick(now);
    render();
    return { rows: document.querySelectorAll('#p-log .tlrow').length, segs: document.querySelectorAll('#p-log .tlseg').length, label: document.querySelector('#p-log .tlrow').getAttribute('aria-label') };
  });
  expect(r.rows).toBe(1);
  expect(r.segs).toBeGreaterThanOrEqual(1);
  expect(r.label).toContain('דני');
});

test('שיפור בחושך: מבהירים רק כשחשוך, ובמידה', async ({ page }) => {
  const g = await page.evaluate(() => [nightGain(130), nightGain(70), nightGain(47.5), nightGain(5)]);
  expect(g).toEqual([1, 1, 2, 2.4]);
});

test('התקנה כאפליקציה: מניפסט, אייקונים ו-service worker קיימים ותקינים', async ({ page, request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone'); expect(m.lang).toBe('he'); expect(m.dir).toBe('rtl');
  for (const ic of m.icons) expect((await request.get('/' + ic.src)).status()).toBe(200);
  const sw = await request.get('/sw.js'); expect(sw.status()).toBe(200); expect(await sw.text()).toContain("addEventListener('fetch'");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  // כל קובץ שמופיע ב-index.html קיים בפועל
  const html = fs.readFileSync(path.join(__dirname, '..', 'site', 'index.html'), 'utf8');
  for (const m2 of html.matchAll(/<script src="(js\/[^"]+)"/g)) expect(fs.existsSync(path.join(__dirname, '..', 'site', m2[1]))).toBe(true);
});
