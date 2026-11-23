// זיהוי גוף חד: מיזוג גופים רחוקים, החלקה לציור והבנת פעילות — על שלדים מלאכותיים (בלי מצלמה).
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
  await page.evaluate(() => {
    // שלד עומד: x,y = אמצע הכתפיים, k = קנה מידה
    window.mk = (x, y, k, o = {}) => {
      const kp = { leftShoulder: [x - 40 * k, y, 0.9], rightShoulder: [x + 40 * k, y, 0.9], leftHip: [x - 28 * k, y + 150 * k, 0.9], rightHip: [x + 28 * k, y + 150 * k, 0.9],
        leftKnee: [x - 28 * k, y + (o.sit ? 170 : 280) * k, 0.9], rightKnee: [x + 28 * k, y + (o.sit ? 170 : 280) * k, 0.9],
        leftWrist: [x - 55 * k, y + (o.hand ? -120 : 140) * k, 0.9], rightWrist: [x + 55 * k, y + 140 * k, 0.9] };
      if (!o.back) { kp.nose = [x, y - 45 * k, 0.9]; kp.leftEye = [x - 10 * k, y - 52 * k, 0.9]; kp.rightEye = [x + 10 * k, y - 52 * k, 0.9]; }
      return { box: [x - 60 * k, y - 80 * k, 120 * k, 480 * k], kp, score: o.score || 0.8, pid: null };
    };
    running = true; S.settings.looks = true; S.settings.bodySharp = true; S.settings.quality = 'balanced';
  });
});

test('גוף רחוק נשאר במעקב כל עוד הוא מאושר, ויורד כשלא', async ({ page }) => {
  const r = await page.evaluate(() => {
    const now = Date.now();
    bodies = [mk(300, 200, 1)];
    bodyAddFar([mk(1000, 300, 0.3), mk(320, 210, 1), mk(700, 300, 0.3, { score: 0.2 })], now); // רחוק חדש, כפילות של הקיים, וחלש מדי
    const afterAdd = bodies.map((b) => !!b.far);
    bodies = bodyMerge([mk(305, 200, 1)], bodies, now + 500);   // פריים מלא חדש שלא רואה את הרחוק
    const kept = bodies.length;
    bodies = bodyMerge([mk(305, 200, 1)], bodies, now + 2500);  // הרחוק לא אושר מחדש
    return { afterAdd, kept, dropped: bodies.length };
  });
  expect(r).toEqual({ afterAdd: [false, true], kept: 2, dropped: 1 });
});

test('פעילות: עומד, יושב, מרים יד, עם הגב, הולך', async ({ page }) => {
  const r = await page.evaluate(() => {
    const now = Date.now(), txt = (b) => bodyActText(b, now);
    const walk = () => { // גוף שמתקדם ימינה לאורך שנייה
      let t = now - 1200, b;
      for (let i = 0; i < 5; i++) { b = mk(300 + i * 60, 200, 1); b.at = t; bodies = [b]; bodySmooth(t); t += 300; }
      return bodyActText(bodies[0], t);
    };
    return { stand: txt(mk(300, 200, 1)), sit: txt(mk(300, 200, 1, { sit: true })), hand: txt(mk(300, 200, 1, { hand: true })), back: txt(mk(300, 200, 1, { back: true })), walk: walk() };
  });
  expect(r).toEqual({ stand: 'עומד', sit: 'יושב', hand: 'עומד · מרים יד', back: 'עומד · עם הגב למצלמה', walk: 'הולך' });
});

test('החלקה: השלד המצויר מתקרב בהדרגה ולא קופץ, ומפרק שנעלם מוחזק רגע', async ({ page }) => {
  const r = await page.evaluate(() => {
    const now = Date.now();
    let b = mk(300, 200, 1); b.at = now; bodies = [b]; bodySmooth(now);
    b = mk(340, 200, 1); delete b.kp.leftWrist; b.at = now + 100; bodies = [b]; bodySmooth(now + 100);
    const sh = DKP(b, 'leftShoulder', now + 100)[0];                // היה 260, היעד 300
    return { between: sh > 260 && sh < 300, held: !!DKP(b, 'leftWrist', now + 100), gone: !DKP(b, 'leftWrist', now + 2000), raw: KP(b, 'leftShoulder')[0] };
  });
  expect(r).toEqual({ between: true, held: true, gone: true, raw: 300 });
});

test('אדם שהפנים שלו לא נראות נספר ברשימה', async ({ page }) => {
  const txt = await page.evaluate(() => {
    const now = Date.now();
    bodies = [mk(300, 200, 1, { back: true })]; tracks = []; lookTick(now - 2000);
    bodies = [mk(300, 200, 1, { back: true })]; lookTick(now);
    render();
    return document.getElementById('hudCount').textContent + ' | ' + document.getElementById('p-now').textContent.trim();
  });
  expect(txt).toBe('אדם אחד מול המצלמה | אדם אחד שהפנים שלו לא נראות');
});
