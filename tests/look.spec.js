// זיהוי לפי מראה: בדיקת הלוגיקה על דמויות מצוירות (בלי מצלמה) — לומדים מול "פנים", ואז מזהים בלי פנים.
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto('/');
  await page.waitForFunction(() => S.settings.v13 === true); // מחכים שהאפליקציה תסיים לעלות
  await page.evaluate(() => {
    // "מצלמה" מצוירת: קנבס שעליו דמויות בצבעי לבוש שונים
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    window.T = {
      c, g: c.getContext('2d'), now: Date.now(),
      clear() { this.g.fillStyle = '#777'; this.g.fillRect(0, 0, 1280, 720); },
      // מצייר דמות ומחזיר "גוף" במבנה שהמנוע מייצר
      fig(x, y, k, shirt, pants, hair) {
        const g = this.g, sw = 90 * k, tl = 150 * k, ll = 130 * k;
        g.fillStyle = hair; g.fillRect(x - 28 * k, y - 95 * k, 56 * k, 40 * k);          // שיער
        g.fillStyle = '#e0b090'; g.fillRect(x - 24 * k, y - 60 * k, 48 * k, 50 * k);     // פנים
        g.fillStyle = shirt; g.fillRect(x - sw / 2 - 8 * k, y, sw + 16 * k, tl);          // חולצה
        g.fillStyle = pants; g.fillRect(x - sw / 2, y + tl, sw, ll * 2);                  // מכנסיים
        const kp = { nose: [x, y - 35 * k, 0.9], leftEar: [x - 22 * k, y - 38 * k, 0.8], rightEar: [x + 22 * k, y - 38 * k, 0.8],
          leftShoulder: [x - sw / 2, y + 5 * k, 0.9], rightShoulder: [x + sw / 2, y + 5 * k, 0.9],
          leftHip: [x - sw * 0.35, y + tl, 0.9], rightHip: [x + sw * 0.35, y + tl, 0.9],
          leftKnee: [x - sw * 0.35, y + tl + ll, 0.9], rightKnee: [x + sw * 0.35, y + tl + ll, 0.9] };
        return { box: [x - sw / 2 - 10 * k, y - 95 * k, sw + 20 * k, 95 * k + tl + ll * 2], kp, score: 0.9, pid: null,
          face: [x - 24 * k, y - 60 * k, 48 * k, 50 * k] };
      },
      // פריים אחד: גופים, ואילו מהם נראים עם פנים מזוהות
      frame(list) {
        this.now += 2000;
        tracks = list.filter((b) => b.facePid).map((b) => ({ pid: b.facePid, box: b.face, seen: this.now, born: this.now - 5000, stable: 5, blocked: new Set() }));
        bodies = list.map((b) => Object.assign({}, b, { pid: null }));
        lookTick(this.now);
        return bodies.map((b) => ({ pid: b.pid, by: b.by }));
      },
    };
    S.people = [{ id: 'A', name: 'דני', samples: [], visits: 1, lastSeen: 0 }, { id: 'B', name: 'רותי', samples: [], visits: 1, lastSeen: 0 }];
    S.settings.looks = true; running = true; LOOK.src = c;
  });
});

const learnBoth = (page) => page.evaluate(() => {
  for (let i = 0; i < 3; i++) {
    T.clear();
    const a = T.fig(300, 200, 1, '#c81e1e', '#1e3a8a', '#111'); a.facePid = 'A';       // דני: חולצה אדומה, ג'ינס, שיער שחור
    const b = T.fig(900, 200, 1, '#15803d', '#d6d3d1', '#d4a017'); b.facePid = 'B';     // רותי: חולצה ירוקה, מכנס בהיר, שיער בלונדיני
    T.frame([a, b]);
  }
  return S.people.map((p) => (p.look ? p.look.s.length : 0));
});

test('לומד מראה כשהפנים נראות, ומזהה אחר כך בלי פנים — גם במקום ובמרחק אחרים', async ({ page }) => {
  expect(await learnBoth(page)).toEqual([1, 1]);
  const res = await page.evaluate(() => {
    T.frame([]); T.now += 5000; T.frame([]); // שניהם יצאו מהפריים
    let out;
    for (let i = 0; i < 6; i++) {
      T.clear();
      // חוזרים רחוקים יותר ובמקומות מוחלפים, עם הגב למצלמה (בלי פנים)
      out = T.frame([T.fig(1000, 300, 0.55, '#c81e1e', '#1e3a8a', '#111'), T.fig(250, 320, 0.55, '#15803d', '#d6d3d1', '#d4a017')]);
    }
    return { out, present: [...presentIds()].sort(), seenA: S.people[0].lastSeen > 0 };
  });
  expect(res.out).toEqual([{ pid: 'A', by: 'look' }, { pid: 'B', by: 'look' }]);
  expect(res.present).toEqual(['A', 'B']);
  expect(res.seenA).toBe(true);
});

test('לבוש שלא נלמד — לא מזוהה', async ({ page }) => {
  await learnBoth(page);
  const out = await page.evaluate(() => {
    T.frame([]); T.now += 5000; T.frame([]);
    let o; for (let i = 0; i < 6; i++) { T.clear(); o = T.frame([T.fig(600, 250, 0.8, '#7e22ce', '#111', '#7c2d12')]); }
    return o;
  });
  expect(out).toEqual([{ pid: null, by: null }]);
});

test('שני אנשים באותו לבוש — לא מנחשים', async ({ page }) => {
  const out = await page.evaluate(() => {
    for (let i = 0; i < 3; i++) {
      T.clear();
      const a = T.fig(300, 200, 1, '#1f2937', '#1e3a8a', '#111'); a.facePid = 'A';
      const b = T.fig(900, 200, 1, '#1f2937', '#1e3a8a', '#111'); b.facePid = 'B';
      T.frame([a, b]);
    }
    T.frame([]); T.now += 5000; T.frame([]);
    let o; for (let i = 0; i < 6; i++) { T.clear(); o = T.frame([T.fig(600, 250, 0.8, '#1f2937', '#1e3a8a', '#111')]); }
    return o;
  });
  expect(out).toEqual([{ pid: null, by: null }]);
});

test('הסתובב במקום: הזהות נשמרת ברצף, והמראה מהגב נלמד', async ({ page }) => {
  await learnBoth(page);
  const res = await page.evaluate(() => {
    T.clear();
    const a = T.fig(300, 200, 1, '#c81e1e', '#1e3a8a', '#111'); // אותו מקום, בלי פנים
    const o = T.frame([a]);
    return { o, by: lookPresent().get('A') };
  });
  expect(res.o).toEqual([{ pid: 'A', by: 'track' }]);
  expect(res.by).toBe('track');
});

test('כיבוי בהגדרות ו"שכח מראה"', async ({ page }) => {
  await learnBoth(page);
  const res = await page.evaluate(() => {
    lookForget(S.people[0]);
    const forgot = !S.people[0].look;
    S.settings.looks = false; T.clear();
    const o = T.frame([T.fig(900, 200, 1, '#15803d', '#d6d3d1', '#d4a017')]);
    return { forgot, o, present: presentIds().size };
  });
  expect(res.forgot).toBe(true);
  expect(res.o).toEqual([{ pid: null, by: undefined }]);
  expect(res.present).toBe(0);
});
