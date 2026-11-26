/* =========================================================
   זיהוי גוף חד — זום על כל גוף, גילוי אנשים רחוקים, החלקה והבנת פעילות
   1) זום: כמו בפנים — חותכים את האזור של כל גוף ברזולוציה מלאה ומריצים עליו שוב את מודל השלד,
      כך שגם אדם רחוק מקבל מספיק פיקסלים והמפרקים מדויקים יותר.
   2) רחוקים: גם האריח המוגדל (שמחפש פנים רחוקות) מחפש גופים, והם נשארים במעקב כל עוד הזום מאשר אותם.
   3) החלקה: השלד שמצויר נע בצורה חלקה ולא "קופץ". ההחלקה היא לציור בלבד — מנוע השמירה מקבל נתונים גולמיים.
   4) פעילות: עומד / יושב / שוכב / מתכופף / הולך / מרים יד / עם הגב למצלמה.
   ========================================================= */
const BODYCFG = {
  perCycle: 2,        // כמה גופים מחדדים בכל סבב (בתורות)
  pad: 0.22,          // שוליים סביב הגוף בחיתוך
  maxCover: 0.6,      // גוף שכבר ממלא את רוב התמונה — אין מה לחדד
  roi: 384,           // גודל החיתוך שנשלח למודל
  farTTL: 1300,       // גוף רחוק שלא אושר מחדש בזמן הזה — יורד
  farMinScore: 0.35, farMinKp: 6,
  ema: 0.35, holdMs: 450,
  walk: 0.45,         // מהירות (באורכי גב לשנייה) שמעליה "הולך"
};
const BODY = { cv: document.createElement('canvas'), rr: 0, sm: [], smSeq: 1 };
const bodySharpOn = () => S.settings.bodySharp === true && S.settings.quality !== 'fast';
const bodyDrawOn = () => S.settings.bodyDraw === true;
const kpCount = (b) => { let n = 0; for (const k in b.kp) if (b.kp[k][2] > 0.3) n++; return n; };
const boxCenterIn = (a, b) => { const cx = a[0] + a[2] / 2, cy = a[1] + a[3] / 2; return cx > b[0] && cx < b[0] + b[2] && cy > b[1] && cy < b[1] + b[3]; };
const sameBody = (a, b) => iou(a, b) > 0.2 || boxCenterIn(a, b) || boxCenterIn(b, a);

/* ---------- מיזוג: פריים חדש + גופים רחוקים שעדיין מאושרים ---------- */
function bodyMerge(fresh, old, now) {
  for (const b of fresh) b.at = now;
  if (!bodySharpOn()) return fresh;
  const out = fresh.slice();
  for (const o of old) {
    if (!o.far || now - o.at > BODYCFG.farTTL) continue;
    if (out.some((b) => sameBody(b.box, o.box))) continue;
    out.push({ box: o.box, kp: o.kp, score: o.score, pid: null, at: o.at, far: true, sharp: o.sharp });
  }
  return out;
}
// גופים שנמצאו באריח המוגדל (אנשים רחוקים שהפריים המוקטן מפספס)
function bodyAddFar(found, now) {
  for (const b of found) {
    if (b.score < BODYCFG.farMinScore || kpCount(b) < BODYCFG.farMinKp) continue;
    const ex = bodies.find((o) => sameBody(o.box, b.box));
    if (ex) { if (ex.far) { ex.box = b.box; ex.kp = b.kp; ex.score = b.score; ex.at = now; } continue;
    }
    b.at = now; b.far = true; bodies.push(b);
  }
}

/* ---------- זום על גוף ---------- */
async function bodyRefine(now) {
  if (!bodySharpOn() || !bodies.length || PERF.level >= 1) return; // מכשיר עמוס — מוותרים על הזום
  if (fpsT.length < 3 && cycle % 2) return; // מכשיר איטי: מחדדים רק בכל סבב שני, כדי לא להאט את זיהוי הפנים
  const W = video.videoWidth, H = video.videoHeight;
  const n = Math.min(fpsT.length < 5 ? 1 : BODYCFG.perCycle, bodies.length);
  for (let i = 0; i < n; i++) {
    const b = bodies[BODY.rr++ % bodies.length]; if (!b) continue;
    const pw = b.box[2] * BODYCFG.pad, ph = b.box[3] * BODYCFG.pad;
    const sx = Math.max(0, b.box[0] - pw), sy = Math.max(0, b.box[1] - ph);
    const sw = Math.min(W - sx, b.box[2] + pw * 2), sh = Math.min(H - sy, b.box[3] + ph * 2);
    if (sw < 40 || sh < 40 || (sw * sh) / (W * H) > BODYCFG.maxCover) continue;
    const k = BODYCFG.roi / Math.max(sw, sh);
    const m = grab(BODY.cv, sx, sy, sw, sh, Math.max(32, sw * k), Math.max(32, sh * k));
    const r = await human.detect(BODY.cv, { face: { enabled: false }, body: { enabled: true, modelPath: BODY_MODEL, maxDetected: 3, minConfidence: 0.2 }, object: { enabled: false } });
    let best = null, bi = 0.25;
    for (const c of (r.body || []).map((x) => mapBody(x, m))) { const v = iou(c.box, b.box); if (v > bi && c.score > 0.2) { bi = v; best = c; } }
    if (!best || !bodies.includes(b)) continue;
    // מפרק-מפרק: לוקחים את המדויק מהזום, ומשאירים את הישן רק כשהזום לא רואה אותו
    for (const part in best.kp) { const q = best.kp[part]; if (q[2] > 0.3 || !b.kp[part] || q[2] >= b.kp[part][2]) b.kp[part] = q; }
    b.box = best.box; b.score = Math.max(b.score, best.score); b.sharp = now; b.at = now;
  }
}

/* ---------- פעילות ---------- */
const BODY_ACT = { walking: 'הולך', hand: 'מרים יד', back: 'עם הגב למצלמה' };
function bodyFacingBack(b, now) {
  if (KP(b, 'nose') || KP(b, 'leftEye') || KP(b, 'rightEye')) return false;
  if (b.ft && now - b.ft.seen < 800) return false;
  return !!(KP(b, 'leftShoulder') && KP(b, 'rightShoulder'));
}
function bodyActivity(b, now) {
  const post = posture(b), sm = b.sm;
  let walking = false;
  if (sm && sm.hist.length >= 3 && post !== 'lying' && post !== 'sitting') {
    const a = sm.hist[0], z = sm.hist[sm.hist.length - 1], dt = (z.t - a.t) / 1000;
    if (dt > 0.5 && z.len) walking = Math.hypot(z.x - a.x, z.y - a.y) / z.len / dt > BODYCFG.walk;
  }
  return { post, walking, hand: handRaised(b), back: bodyFacingBack(b, now) };
}
function bodyActText(b, now) {
  const a = bodyActivity(b, now), parts = [];
  if (a.walking) parts.push(BODY_ACT.walking); else if (a.post) parts.push(POSTURE_NAMES[a.post]);
  if (a.hand) parts.push(BODY_ACT.hand);
  if (a.back) parts.push(BODY_ACT.back);
  return parts.join(' · ');
}
// מה האדם עושה עכשיו (לרשימה)
function personActText(pid) { const b = bodies.find((x) => x.pid === pid); return b && running ? bodyActText(b, Date.now()) : ''; }
// גופים יציבים בלי זהות ובלי פנים — "אדם שהפנים שלו לא נראות"
function facelessBodies(now) {
  if (!running || !lookOn()) return 0;
  return bodies.filter((b) => !b.pid && !(b.ft && now - b.ft.seen < 1500) && b.score > 0.4 && kpCount(b) >= 7 && b.bt && now - b.bt.born > 1200).length;
}

/* ---------- החלקה לציור + היסטוריית תנועה ---------- */
function bodySmooth(now) {
  const used = new Set();
  for (const b of bodies) {
    let s = null, bi = 0.2;
    for (const o of BODY.sm) { if (used.has(o)) continue; const v = iou(o.raw, b.box); // משווים למיקום האמיתי האחרון, לא למוחלק (שמפגר אחרי מי שזז מהר)
      if (v > bi) { bi = v; s = o; } }
    if (!s) { s = { id: BODY.smSeq++, box: b.box.slice(), raw: b.box, kp: {}, hist: [], stamp: 0 }; BODY.sm.push(s); }
    used.add(s); s.seen = now; s.raw = b.box; b.sm = s;
    const a = BODYCFG.ema;
    for (let i = 0; i < 4; i++) s.box[i] += (b.box[i] - s.box[i]) * a;
    for (const part in b.kp) {
      const q = b.kp[part], c = s.kp[part];
      if (q[2] > 0.3) { if (c && now - c[3] < BODYCFG.holdMs * 2) { c[0] += (q[0] - c[0]) * a; c[1] += (q[1] - c[1]) * a; c[2] = q[2]; c[3] = now; } else s.kp[part] = [q[0], q[1], q[2], now]; }
    }
    // נקודת מעקב לתנועה: נרשמת רק כשהגוף התעדכן באמת (לא בכל פריים של ציור)
    const stamp = Math.max(b.at || 0, b.sharp || 0);
    if (stamp > s.stamp) {
      s.stamp = stamp; const t = torso(b);
      const lh = KP(b, 'leftHip'), rh = KP(b, 'rightHip'), hp = lh && rh ? [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2] : lh || rh || [b.box[0] + b.box[2] / 2, b.box[1] + b.box[3] / 2];
      s.hist.push({ t: stamp, x: hp[0], y: hp[1], len: t ? t.len : b.box[3] * 0.3 });
      while (s.hist.length && stamp - s.hist[0].t > 1500) s.hist.shift();
    }
  }
  BODY.sm = BODY.sm.filter((o) => now - o.seen < 1200);
}
// מפרק לציור: המוחלק אם קיים וטרי, אחרת הגולמי
function DKP(b, part, now) {
  const c = b.sm && b.sm.kp[part];
  if (c && now - c[3] < BODYCFG.holdMs) return c;
  return KP(b, part);
}

/* ---------- ציור שלד (כשהשמירה לא פעילה; כשהיא פעילה drawBodies מצייר) ---------- */
function drawSkeletons(now) {
  if (!bodyDrawOn()) { drawLooks(now); return; }
  const lw = Math.max(2.5, canvas.width / 380);
  for (const b of bodies) {
    const p = b.pid && byId(b.pid);
    const faceLive = (b.ft && now - b.ft.seen < 600) || (p && tracks.some((t) => t.pid === p.id && now - t.seen < 600));
    const col = p ? (p.name ? '#22e3a1' : '#ffb547') : '#7c8bff';
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.85;
    ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.beginPath();
    for (const [a, c] of BONES) { const A = DKP(b, a, now), C = DKP(b, c, now); if (A && C) { ctx.moveTo(A[0], A[1]); ctx.lineTo(C[0], C[1]); } }
    // צוואר: מאמצע הכתפיים לראש
    const ls = DKP(b, 'leftShoulder', now), rs = DKP(b, 'rightShoulder', now), nose = DKP(b, 'nose', now);
    if (ls && rs && nose) { ctx.moveTo((ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2); ctx.lineTo(nose[0], nose[1]); }
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    for (const part in b.kp) { if (/Eye|Ear|nose/.test(part)) continue; const q = DKP(b, part, now); if (q) { ctx.beginPath(); ctx.arc(q[0], q[1], lw * 1.25, 0, 7); ctx.fill(); } }
    ctx.restore();
    // תווית: שם (אם אין פנים חיות) + מה הוא עושה
    const act = bodyActText(b, now);
    const name = faceLive ? '' : p ? `${nameOf(p)}${b.by === 'look' ? ' · לפי מראה' : ''}` : (b.bt && now - b.bt.born > 1200 && kpCount(b) >= 7 ? 'אדם · הפנים לא נראות' : '');
    const label = [name, act].filter(Boolean).join(' · ');
    if (!label) continue;
    const fs = Math.max(13, canvas.width / 64);
    // מתחת לפנים יש כבר תווית שם — את הפעילות שמים ליד המותן; בלי פנים — מעל הראש
    const lh = DKP(b, 'leftHip', now), rh = DKP(b, 'rightHip', now), hd = headPoint(b);
    const ax = faceLive && (lh || rh) ? (lh && rh ? (lh[0] + rh[0]) / 2 : (lh || rh)[0]) : hd ? hd[0] : b.box[0] + b.box[2] / 2;
    const ay = faceLive && (lh || rh) ? (lh && rh ? (lh[1] + rh[1]) / 2 : (lh || rh)[1]) + fs * 2 : (hd ? hd[1] : b.box[1]) - fs * 2.2;
    if (faceLive && !(lh || rh)) continue; // רואים רק ראש וכתפיים — אין מקום פנוי לתווית
    ctx.save();
    if (S.settings.mirror) { ctx.translate(ax, 0); ctx.scale(-1, 1); ctx.translate(-ax, 0); }
    ctx.font = `600 ${fs}px Heebo, Arial`; const tw = ctx.measureText(label).width + fs * 1.2;
    ctx.fillStyle = 'rgba(8,10,16,.8)'; roundRect(ax - tw / 2, ay - fs * 1.05, tw, fs * 1.6, fs * 0.8); ctx.fill();
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText(label, ax, ay + fs * 0.12);
    ctx.restore();
  }
}
