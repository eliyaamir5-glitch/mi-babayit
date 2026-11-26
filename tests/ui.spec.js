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
  expect(st).toEqual({ privacy: false, skel: false, clips: true, looks: false, q: 'balanced' }); // סביבה לא מדליקה תוספות ניסיוניות
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

test('ברירת מחדל: התוספות הניסיוניות כבויות, וגם אצל מי שכבר השתמש', async ({ page }) => {
  await page.locator('#obSkip').click();
  expect(await page.evaluate(() => [lookOn(), bodySharpOn(), bodyDrawOn(), S.settings.v13])).toEqual([false, false, false, true]);
  // משתמש קיים ששמר הגדרות ישנות עם התוספות דלוקות
  await page.evaluate(async () => { S.settings.looks = true; S.settings.bodySharp = true; S.settings.bodyDraw = true; delete S.settings.v13; await DB.set('state-v3', S); });
  await page.reload(); await page.waitForTimeout(600);
  expect(await page.evaluate(() => [lookOn(), bodySharpOn(), bodyDrawOn()])).toEqual([false, false, false]);
  // ומי שמדליק בעצמו — נשאר דלוק
  await page.evaluate(async () => { S.settings.looks = true; await DB.set('state-v3', S); });
  await page.reload(); await page.waitForTimeout(600);
  expect(await page.evaluate(() => lookOn())).toBe(true);
});

test('בקרת עומס: מכשיר איטי מוותר על התוספות, וחוזר רק אחרי שהתייצב', async ({ page }) => {
  const r = await page.evaluate(() => {
    const out = [perfLevelFor(200), perfLevelFor(600), perfLevelFor(1200)];
    PERF.ms = 1200; PERF.level = 0; PERF.t0 = performance.now(); perfEnd(); out.push(PERF.level);       // עולה מיד
    PERF.ms = 100; PERF.t0 = performance.now(); perfEnd(); out.push(PERF.level);                          // לא יורד מיד
    PERF.since = Date.now() - 11000; PERF.ms = 100; PERF.t0 = performance.now(); perfEnd(); out.push(PERF.level); // יורד אחרי 10 שניות
    return out;
  });
  expect(r).toEqual([0, 1, 2, 2, 2, 0]);
});

test('דוח אבחון: מספרים בלבד, בלי שמות', async ({ page }) => {
  await page.locator('#obSkip').click();
  await page.evaluate(() => {
    S.people = [{ id: 'A', name: 'שם סודי', samples: [1, 2, 3], visits: 1, lastSeen: 0 }];
    diagVote({ sim: 0.81, second: 0.4 }, 0.68, 'A', false); diagVote({ sim: 0.72, second: 0.69 }, 0.68, 'A', true); diagVote({ sim: 0.3, second: 0.2 }, 0.68, null, false);
  });
  await page.locator('#setBtn').click();
  await page.locator('.setsec-h', { hasText: 'כללי' }).click();
  await page.locator('#dgBtn').click();
  const txt = await page.locator('#dgText').inputValue();
  expect(txt).toContain('גרסה 14');
  expect(txt).toContain('זוהה=2');
  expect(txt).toContain('סיכון לשם שגוי): 1 מתוך 2');
  expect(txt).not.toContain('שם סודי');
});

test('מנוע אמין כברירת מחדל, שיפור בחושך כבוי, וסינון "פנים" שאינן פנים', async ({ page }) => {
  await page.waitForFunction(() => S.settings.v14 === true);
  const r = await page.evaluate(() => ({
    engine: S.settings.engine, night: nightOn(),
    ok: faceOk({ embedding: [1], box: [0, 0, 100, 110], boxScore: 0.8 }),
    tall: faceOk({ embedding: [1], box: [0, 0, 60, 300], boxScore: 0.8 }),
    wide: faceOk({ embedding: [1], box: [0, 0, 300, 80], boxScore: 0.8 }),
    weak: faceOk({ embedding: [1], box: [0, 0, 100, 100], boxScore: 0.3 }),
    sane: engineSane({ face: [{ box: [530, 55, 120, 120], embedding: [1], boxScore: 0.93 }] }).ok,
    none: engineSane({ face: [] }).ok,
    moved: engineSane({ face: [{ box: [100, 300, 120, 120], embedding: [1], boxScore: 0.9 }] }).ok,
  }));
  expect(r).toEqual({ engine: 'webgl', night: false, ok: true, tall: false, wide: false, weak: false, sane: true, none: false, moved: false });
});
