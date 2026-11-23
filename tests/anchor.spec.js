// עיגון אזורים לסצנה: מזיזים את "המצלמה" והאזור צריך לזוז יחד עם החדר.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => {
    // "חדר" מצויר גדול מהפריים; המצלמה רואה חלון ממנו, ואפשר להזיז אותה
    const room = document.createElement('canvas'); room.width = 1800; room.height = 1100;
    const g = room.getContext('2d'); g.fillStyle = '#b9b2a6'; g.fillRect(0, 0, 1800, 1100);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 70; i++) { g.fillStyle = `hsl(${rnd() * 360},${20 + rnd() * 40}%,${25 + rnd() * 50}%)`; g.fillRect(rnd() * 1700, rnd() * 1000, 40 + rnd() * 220, 30 + rnd() * 200); }
    g.fillStyle = '#5b3a1e'; g.fillRect(700, 250, 200, 450); // "דלת"
    const cam = document.createElement('canvas'); cam.width = 1280; cam.height = 720;
    window.AT = { now: Date.now(), view(dx, dy, dim) { const c = cam.getContext('2d'); c.filter = dim ? 'brightness(0.6)' : 'none'; c.drawImage(room, 260 + dx, 190 + dy, 1280, 720, 0, 0, 1280, 720); },
      tick(n = 8) { for (let i = 0; i < n; i++) { this.now += 1000; anchorTick(this.now); } return ANCH.off.map((v) => Math.round(v * 1000) / 1000); } };
    canvas.width = 1280; canvas.height = 720; running = true; ANCH.src = cam; bodies = []; tracks = [];
    // הדלת בחדר נמצאת ב־(700,250) => בפריים ב־(440,60), גודל 200×450
    S.zones = [{ id: 'z1', name: 'דלת', type: 'door', x: 440 / 1280, y: 60 / 720, w: 200 / 1280, h: 450 / 720 }];
    AT.view(0, 0); AT.tick(2);
  });
});

test('המצלמה זזה — האזור נשאר על הדלת', async ({ page }) => {
  const r = await page.evaluate(() => {
    AT.view(90, -40);                 // המצלמה זזה 90 פיקסלים ימינה ו־40 למעלה => הדלת בפריים זזה שמאלה ולמטה
    const off = AT.tick();
    const [x, y] = zoneRect(S.zones[0]);
    return { off, px: Math.round(x * 1280), py: Math.round(y * 720), inDoor: inZone(S.zones[0], 440 - 90 + 100, 60 + 40 + 200), inOld: inZone(S.zones[0], 440 + 190, 60 + 10) };
  });
  expect(Math.abs(r.px - 350)).toBeLessThanOrEqual(8);   // 440 - 90
  expect(Math.abs(r.py - 100)).toBeLessThanOrEqual(8);   // 60 + 40
  expect(r.inDoor).toBe(true);
  expect(r.inOld).toBe(false);
});

test('שינוי תאורה ואדם שעובר — האזור לא זז', async ({ page }) => {
  const r = await page.evaluate(() => {
    AT.view(0, 0, true);                                        // החדר החשיך
    bodies = [{ box: [800, 100, 300, 600], kp: {}, score: 0.9 }]; // אדם גדול בפריים (ממוסך)
    return AT.tick();
  });
  expect(Math.abs(r[0])).toBeLessThan(0.006);
  expect(Math.abs(r[1])).toBeLessThan(0.006);
});

test('אזור חדש שמסומן אחרי שהמצלמה זזה נשמר נכון, ו"יישר מחדש" מאפס', async ({ page }) => {
  const r = await page.evaluate(() => {
    AT.view(60, 0); AT.tick();
    // מסמנים אזור חדש על המסך ב־(0.5, 0.5)
    ZE.pending = { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }; ZE.type = 'window'; document.getElementById('zSave').click();
    const z = S.zones[1], shown = zoneRect(z);
    anchorReset();
    return { shownX: Math.round(shown[0] * 100) / 100, afterReset: [Math.round(S.zones[1].x * 100) / 100, ANCH.off[0]], door: Math.round(S.zones[0].x * 1280) };
  });
  expect(r.shownX).toBe(0.5);
  expect(r.afterReset).toEqual([0.5, 0]);
  expect(Math.abs(r.door - 380)).toBeLessThanOrEqual(8); // 440 - 60: הדלת נשארה איפה שהיא נראית
});

test('הייחוס נשמר ונטען מחדש', async ({ page }) => {
  const r = await page.evaluate(() => {
    anchorSave(Date.now()); const len = S.anchor.g.length;
    ANCH.ref = null; ANCH.off = [0.3, 0.3];
    const ok = anchorLoad(); AT.view(-50, 20);
    const off = AT.tick();
    return { len, ok, px: Math.round(off[0] * 1280), py: Math.round(off[1] * 720) };
  });
  expect(r.ok).toBe(true);
  expect(Math.abs(r.px - 50)).toBeLessThanOrEqual(8);
  expect(Math.abs(r.py + 20)).toBeLessThanOrEqual(8);
});
