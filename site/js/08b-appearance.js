/* =========================================================
   זיהוי לפי מראה — לבוש, שיער ומבנה גוף
   כשהפנים נראות, המערכת לומדת איך האדם נראה היום (צבעי חולצה, מכנסיים, שיער, יחס רגליים־גב).
   כשהוא מסתובב או מתרחק והפנים לא נראות — ממשיכים לזהות אותו לפי המראה.
   המראה נלמד מחדש בכל יום (מחליפים בגדים), ונשמר רק במכשיר.
   זו הערכה ולא זיהוי ודאי: שני אנשים בלבוש דומה לא יזוהו לפי מראה.
   ========================================================= */
const LOOKCFG = {
  thr: 0.72,          // דמיון מינימלי (0..1) כדי להציע זהות לפי מראה
  margin: 0.10,       // פער מינימלי מהמועמד השני — לבוש דומה אצל שניים = לא מזהים
  votesWindow: 6, votesToAssign: 4,
  learnEveryMs: 1500, maxSamples: 10,
  learnMaxSim: 0.93,  // לא שומרים דוגמה כמעט זהה לקיימת
  trackLearnMin: 0.5, // למידה מהגב (בלי פנים) רק כשהמראה עדיין דומה למה שנלמד מול הפנים
  trackTTL: 1500,     // כמה זמן גוף נשאר במעקב אחרי שנעלם
  faceDoubtMs: 2500,  // פנים שנראות כל כך הרבה זמן ולא מאשרות את הזהות — מורידים אותה
  maxAgeMs: 18 * 3600 * 1000,
  toastGapMs: 5 * 60000,
};
const LOOK = { cv: null, src: null, last: null, bt: [], seq: 1, toastAt: {} };
const lookOn = () => S.settings.looks === true;
const lookDay = () => new Date().toDateString();

/* ---------- חתימת צבע של אזור בתמונה ---------- */
// 12 גוונים + 4 רמות אפור (שחור..לבן). מחזיר התפלגות מנורמלת והצבע השולט.
function lookHist(x, y, w, h) {
  const src = LOOK.src || video;
  const W = src.videoWidth || src.width, H = src.videoHeight || src.height;
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
  if (!(w >= 6 && h >= 6)) return null;
  if (!LOOK.cv) { LOOK.cv = document.createElement('canvas'); LOOK.cv.width = 20; LOOK.cv.height = 20; }
  const g = LOOK.cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, x, y, w, h, 0, 0, 20, 20);
  const d = g.getImageData(0, 0, 20, 20).data;
  const hist = new Array(16).fill(0), sum = new Array(16).fill(null).map(() => [0, 0, 0, 0]);
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), v = mx / 255, s = mx ? (mx - mn) / mx : 0;
    let bin;
    if (s < 0.2 || v < 0.16) bin = 12 + Math.min(3, Math.floor(v * 4));
    else {
      let hue = mx === r ? ((gg - b) / (mx - mn)) % 6 : mx === gg ? (b - r) / (mx - mn) + 2 : (r - gg) / (mx - mn) + 4;
      if (hue < 0) hue += 6;
      bin = Math.min(11, Math.floor(hue * 2));
    }
    hist[bin]++; const a = sum[bin]; a[0] += r; a[1] += gg; a[2] += b; a[3]++;
  }
  const n = d.length / 4;
  // ריכוך: חלק מכל גוון זולג לשכנים, כדי ששינוי קל בתאורה לא ישבור את ההתאמה
  const out = new Array(16).fill(0);
  for (let i = 0; i < 12; i++) { const v = hist[i] / n; out[i] += v * 0.7; out[(i + 1) % 12] += v * 0.15; out[(i + 11) % 12] += v * 0.15; }
  for (let i = 12; i < 16; i++) { const v = hist[i] / n; out[i] += v * 0.8; if (i > 12) out[i - 1] += v * 0.1; else out[i] += v * 0.1; if (i < 15) out[i + 1] += v * 0.1; else out[i] += v * 0.1; }
  let top = 0; for (let i = 1; i < 16; i++) if (hist[i] > hist[top]) top = i;
  const c = sum[top];
  return { h: out.map((v) => Math.round(v * 1000) / 1000), c: c[3] ? [Math.round(c[0] / c[3]), Math.round(c[1] / c[3]), Math.round(c[2] / c[3])] : [0, 0, 0] };
}
const histSim = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.min(a[i], b[i]); return s; };

/* ---------- חתימת מראה של גוף: חולצה, מכנסיים, שיער, יחס גוף ---------- */
function lookSig(b) {
  const ls = KP(b, 'leftShoulder'), rs = KP(b, 'rightShoulder'), lh = KP(b, 'leftHip'), rh = KP(b, 'rightHip');
  let t = torso(b);
  // קרוב למצלמה רואים רק ראש וכתפיים (בלי מותניים) — מעריכים את אורך הגב לפי רוחב הכתפיים
  if (!t && ls && rs) { const w = Math.abs(ls[0] - rs[0]); t = { len: w * 1.35, ang: 0, sh: [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2] }; }
  if (!t || !(ls || rs) || t.len < 24 || t.ang > 50) return null; // צריך גב זקוף יחסית וגדול מספיק
  const shY = ls && rs ? (ls[1] + rs[1]) / 2 : (ls || rs)[1];
  const hipY = lh && rh ? (lh[1] + rh[1]) / 2 : lh || rh ? (lh || rh)[1] : shY + t.len;
  const cx = ls && rs ? (ls[0] + rs[0]) / 2 : t.sh[0];
  const shW = Math.max(ls && rs ? Math.abs(ls[0] - rs[0]) : 0, t.len * 0.4); // מהצד הכתפיים "נעלמות" — לוקחים רוחב מינימלי
  const sig = { t: null, l: null, h: null, r: null, at: Date.now() };
  sig.t = lookHist(cx - shW * 0.38, shY + t.len * 0.12, shW * 0.76, t.len * 0.8);
  if (!sig.t) return null;
  const lk = KP(b, 'leftKnee'), rk = KP(b, 'rightKnee');
  if ((lk || rk) && (lh || rh)) {
    const kY = lk && rk ? (lk[1] + rk[1]) / 2 : (lk || rk)[1];
    const xs = [lh, rh, lk, rk].filter(Boolean).map((p) => p[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), lw = Math.max(x1 - x0, shW * 0.5), lc = (x0 + x1) / 2;
    if (kY - hipY > t.len * 0.3) { sig.l = lookHist(lc - lw * 0.5, hipY + (kY - hipY) * 0.15, lw, (kY - hipY) * 0.8); sig.r = Math.round((kY - hipY) / t.len * 100) / 100; }
  }
  // שיער: הרצועה שמעל הראש. מהגב אין אף ועיניים, אז מעריכים את מקום הראש לפי הכתפיים
  const le = KP(b, 'leftEar'), re = KP(b, 'rightEar'), hp = headPoint(b);
  const hw = le && re ? Math.max(Math.abs(le[0] - re[0]), shW * 0.3) : shW * 0.45;
  const hx = hp ? hp[0] : cx, hy = hp ? hp[1] : shY - shW * 0.55;
  sig.h = lookHist(hx - hw * 0.32, hy - hw * 0.85, hw * 0.64, hw * 0.4);
  return sig;
}
// דמיון בין שתי חתימות. החולצה חובה; מכנסיים, שיער ויחס גוף מצטרפים כשנראים בשתיהן.
function lookSim(a, b) {
  if (!a || !b || !a.t || !b.t) return 0;
  let s = histSim(a.t.h, b.t.h) * 0.55, w = 0.55;
  if (a.l && b.l) { s += histSim(a.l.h, b.l.h) * 0.3; w += 0.3; }
  if (a.h && b.h) { s += histSim(a.h.h, b.h.h) * 0.15; w += 0.15; }
  let v = s / w;
  if (a.r && b.r) v -= Math.min(0.08, Math.abs(a.r - b.r) * 0.15);
  return Math.max(0, v);
}

/* ---------- מה נלמד על כל אדם היום ---------- */
function lookOf(p) {
  if (!p || !p.look) return null;
  if (p.look.day !== lookDay() || Date.now() - p.look.t > LOOKCFG.maxAgeMs || !p.look.s || !p.look.s.length) { delete p.look; return null; }
  return p.look;
}
function lookLearn(p, sig, now) {
  let lk = lookOf(p);
  if (!lk) lk = p.look = { day: lookDay(), t: now, s: [], at: 0 };
  if (now - lk.at < LOOKCFG.learnEveryMs) return false;
  lk.at = now; lk.t = now;
  if (lk.s.some((x) => lookSim(x, sig) > LOOKCFG.learnMaxSim && !!x.l === !!sig.l)) return false;
  lk.s.push(sig); if (lk.s.length > LOOKCFG.maxSamples) lk.s.shift();
  save();
  return true;
}
function lookForget(p) { if (p && p.look) { delete p.look; save(); } LOOK.bt.forEach((t) => { if (p && t.pid === p.id && t.by !== 'face') { t.pid = null; t.votes = []; } }); }
const lookScore = (p, sig) => { const lk = lookOf(p); let m = 0; if (lk) for (const x of lk.s) m = Math.max(m, lookSim(x, sig)); return m; };
function bestLook(sig, excluded) {
  let best = null, bs = 0, second = 0;
  for (const p of S.people) {
    if (excluded.has(p.id)) continue;
    const v = lookScore(p, sig);
    if (v > bs) { second = bs; bs = v; best = p; } else if (v > second) second = v;
  }
  return { person: best, sim: bs, second };
}

/* ---------- טיק: שיוך גופים לאנשים — פנים, רצף מעקב, ואז מראה ---------- */
function lookTick(now) {
  if (!running || !lookOn()) { LOOK.bt = []; return; }
  if (bodies === LOOK.last) return; // אין פריים גוף חדש
  LOOK.last = bodies;
  // 1) רצף: כל גוף מקושר לגוף מהפריים הקודם לפי חפיפה
  const usedT = new Set();
  for (const b of bodies) {
    let bt = null, bi = 0.3;
    for (const t of LOOK.bt) { if (usedT.has(t)) continue; const v = iou(t.box, b.box); if (v > bi) { bi = v; bt = t; } }
    if (!bt) { bt = { id: LOOK.seq++, box: null, pid: null, by: null, votes: [], born: now }; LOOK.bt.push(bt); }
    usedT.add(bt); bt.box = b.box.slice(); bt.seen = now; b.bt = bt; b.by = null;
  }
  LOOK.bt = LOOK.bt.filter((t) => now - t.seen < LOOKCFG.trackTTL);
  // 2) פנים: גוף שהראש שלו בתוך מסגרת פנים חיה
  const facePids = new Set(tracks.filter((t) => t.pid && now - t.seen < 600).map((t) => t.pid));
  for (const b of bodies) {
    const h = headPoint(b); b.ft = null;
    if (h) for (const t of tracks) {
      if (now - t.seen > 500) continue;
      const [x, y, w, hh] = t.box, pad = w * 0.4;
      if (h[0] > x - pad && h[0] < x + w + pad && h[1] > y - pad && h[1] < y + hh + pad) { b.ft = t; break; }
    }
    const bt = b.bt;
    if (b.ft && b.ft.pid) { bt.pid = b.ft.pid; bt.by = 'face'; bt.votes = []; b.pid = bt.pid; b.by = 'face'; }
    else if (bt.pid) {
      // הפנים נראות כבר זמן מה ולא מאשרות, או שהאדם הזה נראה עכשיו בפנים במקום אחר — הזהות יורדת
      const doubt = b.ft && (now - b.ft.born > LOOKCFG.faceDoubtMs || (b.ft.blocked && b.ft.blocked.has(bt.pid)));
      if (doubt || facePids.has(bt.pid) || !byId(bt.pid)) { bt.pid = null; bt.by = null; bt.votes = []; }
    }
  }
  // 3) רצף מעקב ומראה
  const taken = new Set(bodies.filter((b) => b.by === 'face').map((b) => b.pid));
  for (const b of bodies) {
    if (b.by === 'face') continue;
    const bt = b.bt;
    if (bt.pid && !taken.has(bt.pid)) { b.pid = bt.pid; b.by = bt.by === 'look' ? 'look' : 'track'; bt.by = b.by; taken.add(bt.pid); continue; }
    if (bt.pid) { bt.pid = null; bt.by = null; }
    b.sig = lookSig(b); if (!b.sig) continue;
    const ex = new Set([...facePids, ...taken]);
    const m = bestLook(b.sig, ex);
    const ok = m.person && m.sim >= LOOKCFG.thr && m.sim - m.second >= LOOKCFG.margin;
    bt.votes.push(ok ? m.person.id : null); if (bt.votes.length > LOOKCFG.votesWindow) bt.votes.shift();
    b.lookSim = m.sim;
    if (ok && bt.votes.filter((v) => v === m.person.id).length >= LOOKCFG.votesToAssign) {
      bt.pid = m.person.id; bt.by = 'look'; bt.votes = []; b.pid = bt.pid; b.by = 'look'; taken.add(bt.pid);
      const p = m.person;
      if (p.name && now - (LOOK.toastAt[p.id] || 0) > LOOKCFG.toastGapMs) { LOOK.toastAt[p.id] = now; toast(p, `${p.name} זוהה לפי מראה`, 'הפנים לא נראות — מזהה לפי הלבוש והמבנה'); }
    }
  }
  // 4) נוכחות ולמידה
  for (const b of bodies) {
    const p = b.pid && b.by && byId(b.pid); if (!p) continue;
    p.lastSeen = now; if (p.lastVisit) p.lastVisit = now; // נשאר בחדר = לא "כניסה חדשה" כשהפנים חוזרות
    const crowded = bodies.some((o) => o !== b && iou(o.box, b.box) > 0.1);
    if (b.by === 'face' && b.ft.stable >= 2 && !crowded) { const sig = b.sig || lookSig(b); if (sig) lookLearn(p, sig, now); }
    else if (b.by === 'track' && !crowded) { const sig = b.sig || lookSig(b); if (sig && lookScore(p, sig) >= LOOKCFG.trackLearnMin) lookLearn(p, sig, now); }
  }
}
// מי נמצא עכשיו רק לפי הגוף (בלי פנים)
function lookPresent() { const m = new Map(); if (lookOn()) for (const b of bodies) if (b.pid && b.by && b.by !== 'face') m.set(b.pid, b.by); return m; }

/* ---------- תצוגה ---------- */
function lookChips(p) {
  const lk = lookOf(p); if (!lk) return '';
  const last = lk.s[lk.s.length - 1], withLegs = lk.s.slice().reverse().find((x) => x.l), withHair = lk.s.slice().reverse().find((x) => x.h);
  const chip = (c, title) => `<i class="lookchip" style="background:rgb(${c[0]},${c[1]},${c[2]})" title="${title}" role="img" aria-label="${title}"></i>`;
  return (withHair ? chip(withHair.h.c, 'שיער') : '') + chip(last.t.c, 'חולצה') + (withLegs ? chip(withLegs.l.c, 'מכנסיים') : '');
}
function renderLook(p) {
  const el = $('mLook'); if (!el) return;
  const lk = lookOf(p);
  if (!lookOn()) el.innerHTML = '<span>זיהוי לפי מראה כבוי בהגדרות</span>';
  else if (!lk) el.innerHTML = '<span>מראה היום: עוד לא נלמד. יילמד כשהפנים והגוף ייראו יחד מול המצלמה.</span>';
  else el.innerHTML = `<span>מראה היום:</span> ${lookChips(p)} <span>${lk.s.length} דוגמאות</span> <button type="button" class="ghost mini" id="mLookForget">שכח מראה</button>`;
  const b = $('mLookForget'); if (b) b.onclick = () => { lookForget(p); renderLook(p); toast(p, 'המראה נמחק', 'יילמד מחדש בפעם הבאה שהפנים ייראו'); };
}
// תווית על גוף שמזוהה בלי פנים (כשהשמירה לא פעילה; כשהיא פעילה drawBodies מצייר)
function drawLooks(now) {
  if (!lookOn()) return;
  for (const b of bodies) {
    const p = b.pid && b.by && b.by !== 'face' && byId(b.pid);
    if (!p || tracks.some((t) => t.pid === p.id && now - t.seen < 600)) continue;
    const col = p.name ? '#00d4ff' : '#ffb547';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, canvas.width / 500); ctx.globalAlpha = 0.7; ctx.setLineDash([10, 8]);
    roundRect(b.box[0], b.box[1], b.box[2], b.box[3], 14); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const h = headPoint(b) || [b.box[0] + b.box[2] / 2, b.box[1]];
    const fs = Math.max(16, canvas.width / 50), label = `${nameOf(p)} · לפי מראה`;
    if (S.settings.mirror) { ctx.translate(h[0], 0); ctx.scale(-1, 1); ctx.translate(-h[0], 0); }
    ctx.font = `700 ${fs}px Heebo, Arial`; const tw = ctx.measureText(label).width + fs;
    ctx.fillStyle = 'rgba(8,10,16,.82)'; roundRect(h[0] - tw / 2, h[1] - fs * 2.6, tw, fs * 1.6, fs * 0.6); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText(label, h[0], h[1] - fs * 1.4);
    ctx.restore();
  }
}
