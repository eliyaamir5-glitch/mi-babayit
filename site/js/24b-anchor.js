/* =========================================================
   עיגון אזורים לסצנה — האזורים "יושבים" על הדלת / החלון / הספה גם כשהמצלמה זזה קצת
   שומרים תמונת ייחוס קטנה של קווי המתאר בחדר (לא תמונה של אנשים: 96×54, קצוות בלבד),
   ובכל שנייה בערך מודדים בכמה התמונה זזה ביחס אליה. האזורים זזים באותה מידה.
   עובד על הזזה קטנה של המצלמה (עד כ־15% מהתמונה). סיבוב גדול או מעבר לחדר אחר — מסמנים מחדש.
   ========================================================= */
const ANCH = { w: 96, h: 54, rx: 15, ry: 9, cv: document.createElement('canvas'), ref: null, off: [0, 0], draw: [0, 0], conf: 0, at: 0, lowSince: 0, warned: 0, savedAt: 0, src: null, every: 700 };
ANCH.cv.width = ANCH.w; ANCH.cv.height = ANCH.h;
const anchorOn = () => S.settings.anchor !== false;

// מפת קצוות מנורמלת (לא תלויה בבהירות) של הפריים הנוכחי
function anchorGrab() {
  const src = ANCH.src || video, W = ANCH.w, H = ANCH.h;
  const g = ANCH.cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, 0, 0, W, H);
  const d = g.getImageData(0, 0, W, H).data, lum = new Float32Array(W * H), out = new Float32Array(W * H);
  for (let i = 0, j = 0; j < W * H; i += 4, j++) lum[j] = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
  let sum = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, v = Math.abs(lum[i + 1] - lum[i - 1]) + Math.abs(lum[i + W] - lum[i - W]);
    out[i] = v; sum += v;
  }
  const mean = sum / (W * H) || 1;
  for (let i = 0; i < out.length; i++) out[i] = Math.min(4, out[i] / mean);
  return out;
}
// מסכה: אנשים וחיות זזים — לא משתתפים במדידה
function anchorMask() {
  const W = ANCH.w, H = ANCH.h, m = new Uint8Array(W * H);
  const VW = canvas.width || 1, VH = canvas.height || 1;
  const boxes = bodies.map((b) => b.box).concat(tracks.map((t) => [t.box[0] - t.box[2] * 0.5, t.box[1] - t.box[3] * 0.5, t.box[2] * 2, t.box[3] * 3]));
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor((b[0] - b[2] * 0.1) / VW * W)), x1 = Math.min(W, Math.ceil((b[0] + b[2] * 1.1) / VW * W));
    const y0 = Math.max(0, Math.floor((b[1] - b[3] * 0.1) / VH * H)), y1 = Math.min(H, Math.ceil((b[1] + b[3] * 1.1) / VH * H));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1;
  }
  return m;
}
// בכמה פיקסלים (בקנה המידה הקטן) התמונה זזה ביחס לייחוס, ועד כמה המדידה אמינה
function anchorShift(ref, cur, mask) {
  const W = ANCH.w, H = ANCH.h, RX = ANCH.rx, RY = ANCH.ry;
  let best = Infinity, bx = 0, by = 0, total = 0, n = 0; const costs = {};
  for (let dy = -RY; dy <= RY; dy++) for (let dx = -RX; dx <= RX; dx++) {
    let c = 0, k = 0;
    const y0 = Math.max(1, 1 - dy), y1 = Math.min(H - 1, H - 1 - dy), x0 = Math.max(1, 1 - dx), x1 = Math.min(W - 1, W - 1 - dx);
    for (let y = y0; y < y1; y += 2) { const r = y * W, q = (y + dy) * W + dx; for (let x = x0; x < x1; x += 2) { if (mask[q + x]) continue; c += Math.abs(ref[r + x] - cur[q + x]); k++; } }
    if (k < 200) continue;
    c /= k; costs[dx + ',' + dy] = c; total += c; n++;
    if (c < best) { best = c; bx = dx; by = dy; }
  }
  if (!n) return { dx: 0, dy: 0, conf: 0 };
  // דיוק תת־פיקסל: פרבולה סביב המינימום
  const sub = (a, b, c) => (a == null || c == null || a + c - 2 * b <= 0 ? 0 : Math.max(-0.5, Math.min(0.5, (a - c) / (2 * (a + c - 2 * b)))));
  const fx = sub(costs[(bx - 1) + ',' + by], best, costs[(bx + 1) + ',' + by]), fy = sub(costs[bx + ',' + (by - 1)], best, costs[bx + ',' + (by + 1)]);
  return { dx: bx + fx, dy: by + fy, conf: Math.max(0, 1 - best / (total / n)), edge: Math.abs(bx) >= RX || Math.abs(by) >= RY };
}
function anchorTick(now) {
  if (!running || !anchorOn() || !S.zones.length || ZE.on) return;
  if (now - ANCH.at < ANCH.every) return;
  ANCH.at = now;
  const cur = anchorGrab();
  if (!ANCH.ref) { // אין ייחוס (אזורים מגרסה קודמת, או אחרי יישור) — המצב הנוכחי הוא הייחוס
    if (!anchorLoad()) { ANCH.ref = cur; ANCH.off = [0, 0]; anchorSave(now, true); }
    return;
  }
  const mask = anchorMask(), r = anchorShift(ANCH.ref, cur, mask);
  ANCH.conf = r.conf;
  if (r.conf >= 0.22 && !r.edge) {
    ANCH.lowSince = 0;
    const nx = r.dx / ANCH.w, ny = r.dy / ANCH.h;
    const stable = Math.abs(nx - ANCH.off[0]) * ANCH.w < 0.6 && Math.abs(ny - ANCH.off[1]) * ANCH.h < 0.6;
    ANCH.off = [ANCH.off[0] + (nx - ANCH.off[0]) * 0.6, ANCH.off[1] + (ny - ANCH.off[1]) * 0.6];
    // הייחוס מתעדכן לאט (אור משתנה, רהיט שהוזז) — רק כשהמדידה יציבה ובטוחה
    if (stable && r.conf > 0.4) {
      const W = ANCH.w, H = ANCH.h, dx = Math.round(r.dx), dy = Math.round(r.dy);
      for (let y = Math.max(0, -dy); y < Math.min(H, H - dy); y++) for (let x = Math.max(0, -dx); x < Math.min(W, W - dx); x++) {
        const q = (y + dy) * W + x + dx; if (mask[q]) continue; const i = y * W + x; ANCH.ref[i] = ANCH.ref[i] * 0.97 + cur[q] * 0.03;
      }
    }
    if (now - ANCH.savedAt > 120000) anchorSave(now);
  } else {
    if (!ANCH.lowSince) ANCH.lowSince = now;
    if (now - ANCH.lowSince > 10000 && now - ANCH.warned > 10 * 60000) {
      ANCH.warned = now;
      toast(null, '📍 המצלמה זזה הרבה', 'האזורים אולי לא יושבים במקום. פתח "דלתות ואזורים" ולחץ "יישר מחדש" או סמן שוב');
    }
  }
}
// שמירה וטעינה של הייחוס (כדי לזהות שהמצלמה זזה גם בין הפעלה להפעלה)
function anchorSave(now, quiet) {
  if (!ANCH.ref) return;
  let s = ''; for (let i = 0; i < ANCH.ref.length; i++) s += String.fromCharCode(Math.round(ANCH.ref[i] * 60));
  S.anchor = { w: ANCH.w, h: ANCH.h, g: btoa(s), off: ANCH.off.map((v) => Math.round(v * 1e4) / 1e4) };
  ANCH.savedAt = now; save();
}
function anchorLoad() {
  const a = S.anchor; if (!a || a.w !== ANCH.w || a.h !== ANCH.h || !a.g) return false;
  try { const s = atob(a.g); if (s.length !== ANCH.w * ANCH.h) return false; ANCH.ref = new Float32Array(s.length); for (let i = 0; i < s.length; i++) ANCH.ref[i] = s.charCodeAt(i) / 60; ANCH.off = (a.off || [0, 0]).slice(); ANCH.draw = ANCH.off.slice(); return true; } catch (e) { return false; }
}
// "יישר מחדש": האזורים נשארים איפה שהם מוצגים עכשיו, והתמונה הנוכחית הופכת לייחוס
function anchorReset() {
  for (const z of S.zones) { z.x += ANCH.off[0]; z.y += ANCH.off[1]; }
  ANCH.off = [0, 0]; ANCH.draw = [0, 0]; ANCH.ref = null; ANCH.lowSince = 0; ANCH.at = 0; delete S.anchor; save();
}
// המלבן של אזור על המסך (0..1), אחרי ההזזה. smooth = לציור (נע בעדינות)
function zoneRect(z, smooth) { const o = anchorOn() ? (smooth ? ANCH.draw : ANCH.off) : [0, 0]; return [z.x + o[0], z.y + o[1], z.w, z.h]; }
function anchorEase() { for (let i = 0; i < 2; i++) ANCH.draw[i] += (ANCH.off[i] - ANCH.draw[i]) * 0.2; }
$('zRealign').onclick = () => { anchorReset(); toast(null, '📍 האזורים יושרו', 'המיקום הנוכחי של המצלמה נשמר כנקודת הייחוס'); };
