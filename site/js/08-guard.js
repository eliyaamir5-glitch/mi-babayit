/* =========================================================
   מנוע השמירה — תנוחת גוף, תנועה, נפילה, רעידות, לבד, מחוץ לטווח
   ========================================================= */
const BODY_MODEL = window.MIBABAYIT_BODY || 'https://cdn.jsdelivr.net/npm/@vladmandic/human-models@3.0.4/models/movenet-multipose.json';
const G = {};            // מצב חי לכל אדם בשמירה
let bodies = [];         // שלדים אחרונים, בקואורדינטות של הווידאו
const STATE_NAMES = { ok: 'תקין', asking: 'שואל', emergency: 'חירום', paused: 'מושהה', away: 'לא בטווח', idle: 'ממתין', verify: 'ממתין לאישור' };
const REASON_NAMES = { still: 'לא זז', fall: 'נפילה', tremor: 'תנועה חריגה / רעידות', alone: 'נשאר לבד', away: 'יצא מהטווח', drill: 'תרגול' };
const guardActive = () => running && S.settings.guardOn && guarded().length > 0;

function gs(pid) {
  if (!G[pid]) G[pid] = { state: 'idle', lastMotion: Date.now(), ref: null, hist: [], path: [], askN: 0, nextAsk: 0, reason: null,
    lastSeen: 0, seenOnce: false, bodyBox: null, bodyAt: 0, torsoRef: 0, faceRef: 0, upright: 0, lyingSince: 0, dropAt: 0, dropFaceOnly: false, dropBase: 0,
    tremorSince: 0, aloneSince: 0, emAt: 0, lastRemind: 0, lastCall: 0, handFrames: 0, startedAt: Date.now() };
  return G[pid];
}
function dropG(id) { if (G[id]) { delete G[id]; afterEmergencyChange(); } }
function freshG(s, now) { s.lastSeen = now; s.lastMotion = now; s.seenOnce = false; s.state = 'idle'; s.tremorSince = 0; s.aloneSince = 0; s.path = []; s.hist = []; s.ref = null; s.dropAt = 0; s.lyingSince = 0; s.fallCand = null; }
function guardProfileChanged(p, wasGuard) {
  if (p.guard && p.guard.on && !wasGuard) { delete G[p.id]; gs(p.id); logSafety(p, 'start', 'השמירה הופעלה'); toast(p, `שמירה פעילה: ${p.name}`, 'אשים לב אליו ואשאל אם משהו נראה חריג'); }
  if (wasGuard && !(p.guard && p.guard.on)) { if (G[p.id] && G[p.id].state === 'emergency') endEmergency(p, 'השמירה כובתה'); delete G[p.id]; logSafety(p, 'stop', 'השמירה כובתה'); }
  renderGuard();
}
function logSafety(p, ev, text, snap, clip) {
  S.safety = S.safety || [];
  S.safety.unshift({ t: Date.now(), id: p ? p.id : null, ev, text, snap: snap || null, clip: clip || null });
  if (S.safety.length > 400) S.safety.length = 400;
  let n = 0; S.safety.forEach((e) => { if (e.snap && ++n > 40) e.snap = null; }); // שומרים תמונות רק ל־40 האירועים האחרונים
  save();
}
function inSleepHours() {
  if (!S.settings.sleepOn) return false;
  const m = (s) => { const [h, mm] = (s || '0:0').split(':').map(Number); return h * 60 + (mm || 0); };
  const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = m(S.settings.sleepFrom), b = m(S.settings.sleepTo);
  return a <= b ? now >= a && now < b : now >= a || now < b;
}
const fmtDur = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} שעות` : `${m}:${String(s % 60).padStart(2, '0')}`; };

/* ---------- גוף ---------- */
const KP = (b, part) => { const k = b.kp[part]; return k && k[2] > 0.3 ? k : null; };
function mapBody(b, m) {
  const kp = {};
  for (const k of b.keypoints || []) kp[k.part] = [m.sx + k.position[0] * m.kx, m.sy + k.position[1] * m.ky, k.score];
  const bx = b.box || [0, 0, 0, 0];
  return { box: [m.sx + bx[0] * m.kx, m.sy + bx[1] * m.ky, bx[2] * m.kx, bx[3] * m.ky], kp, score: b.score, pid: null };
}
function headPoint(b) {
  const n = KP(b, 'nose'); if (n) return n;
  const pts = ['leftEye', 'rightEye', 'leftEar', 'rightEar'].map((p) => KP(b, p)).filter(Boolean);
  if (!pts.length) return null;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length, 1];
}
function torso(b) {
  const ls = KP(b, 'leftShoulder'), rs = KP(b, 'rightShoulder'), lh = KP(b, 'leftHip'), rh = KP(b, 'rightHip');
  const sh = ls && rs ? [(ls[0] + rs[0]) / 2, (ls[1] + rs[1]) / 2] : ls || rs;
  const hp = lh && rh ? [(lh[0] + rh[0]) / 2, (lh[1] + rh[1]) / 2] : lh || rh;
  if (!sh || !hp) return null;
  const dx = hp[0] - sh[0], dy = hp[1] - sh[1];
  return { len: Math.hypot(dx, dy), ang: Math.atan2(Math.abs(dx), Math.abs(dy)) * 180 / Math.PI, sh };
}
function handRaised(b) {
  const t = torso(b); const head = headPoint(b);
  for (const side of ['left', 'right']) {
    const w = KP(b, side + 'Wrist'), s = KP(b, side + 'Shoulder');
    if (!w || !s) continue;
    const lim = head ? Math.min(head[1], s[1] - (t ? t.len * 0.25 : 0)) : s[1] - (t ? t.len * 0.35 : 40);
    if (w[1] < lim) return true;
  }
  return false;
}
function associateBodies(now) {
  for (const b of bodies) {
    if (b.pid && b.by && lookOn()) continue; // כבר שויך במודול הזיהוי לפי מראה (פנים / רצף / מראה)
    const h = headPoint(b);
    let best = null;
    if (h) for (const t of tracks) {
      if (!t.pid || now - t.seen > 500) continue;
      const [x, y, w, hh] = t.box, pad = w * 0.4;
      if (h[0] > x - pad && h[0] < x + w + pad && h[1] > y - pad && h[1] < y + hh + pad) { best = t; break; }
    }
    if (best) { b.pid = best.pid; continue; }
    // המשך מעקב לפי הגוף כשהפנים לא נראות (הסתובב, התכופף, נפל)
    let bi = 0.25, bp = null;
    for (const pid in G) { const s = G[pid]; if (!s.bodyBox || now - s.bodyAt > 5000) continue; const v = iou(s.bodyBox, b.box); if (v > bi) { bi = v; bp = pid; } }
    if (!bp) { // אחרי נפילה צורת הגוף משתנה לגמרי — משייכים לפי קרבה למיקום האחרון
      let bd = Infinity;
      for (const pid in G) {
        const s = G[pid]; if (!s.bodyBox || now - s.bodyAt > 4000 || tracks.some((t) => t.pid === pid && now - t.seen < 600)) continue;
        const d = Math.hypot(s.bodyBox[0] + s.bodyBox[2] / 2 - (b.box[0] + b.box[2] / 2), s.bodyBox[1] + s.bodyBox[3] - (b.box[1] + b.box[3]));
        if (d < Math.max(s.bodyBox[2], s.bodyBox[3]) * 1.2 && d < bd) { bd = d; bp = pid; }
      }
    }
    if (bp && !bodies.some((o) => o !== b && o.pid === bp)) b.pid = bp;
  }
}

/* ---------- טיק שמירה ---------- */
function guardTick() {
  const now = Date.now();
  if (!guardActive()) return;
  associateBodies(now);
  const thr = 0.13 - 0.011 * (S.settings.motionSens || 5);   // רגישות 1..10
  const presentAdults = countAdults(now);
  for (const p of guarded()) {
    const s = gs(p.id), R = effRules(p);
    const tr = tracks.find((t) => t.pid === p.id && now - t.seen < 600);
    const body = bodies.find((b) => b.pid === p.id);
    const present = !!(tr || body);
    if (p.guard.pausedUntil && p.guard.pausedUntil > now) { s.state = s.state === 'emergency' ? s.state : 'paused'; if (present) { s.lastSeen = now; s.lastMotion = now; } continue; }
    if (s.state === 'paused') freshG(s, now);

    if (present) {
      if (s.state === 'away' && now - s.lastSeen > 30000) { s.lastMotion = now; s.ref = null; } // חזר אחרי היעדרות ארוכה
      s.lastSeen = now; s.seenOnce = true;
      if (s.state === 'idle') { s.state = 'ok'; s.lastMotion = now; s.ref = null; } // נראה לראשונה — הספירה מתחילה עכשיו
      else if (s.state === 'away') s.state = 'ok';
      if (body) { s.bodyBox = body.box.slice(); s.bodyAt = now; }
    } else { s.tremorSince = 0; s.path = []; s.floorSince = 0; if (s.okSig && now - s.lastSeen > 60000) s.okSig = null; if (s.state === 'ok' && s.seenOnce && now - Math.max(s.lastSeen, s.remoteSeen || 0) > 4000) s.state = 'away'; }

    // ----- תנועה: מרחק מתנוחת ייחוס (לא פריים מול פריים, כדי שתנועה איטית תיספר ורעש לא יצטבר)
    if (present) {
      const pts = {}; let scale = 0;
      if (body) {
        const t = torso(body); if (t) { scale = t.len; if (t.ang < 30) s.torsoRef = s.torsoRef ? s.torsoRef * 0.95 + t.len * 0.05 : t.len; }
        for (const k in body.kp) if (body.kp[k][2] > 0.35) pts['b' + k] = body.kp[k];
        if (!scale) scale = body.box[3] * 0.3;
      }
      if (tr) {
        const [x, y, w, h] = tr.box; s.faceRef = s.faceRef ? s.faceRef * 0.9 + w * 0.1 : w;
        pts.fc = [x + w / 2, y + h / 2]; pts.fs = [x + w, y + h];
        const a = tr.face && tr.face.rotation && tr.face.rotation.angle;
        if (a) pts.fa = [x + w / 2 + a.yaw * w * 1.2, y + h / 2 + a.pitch * w * 1.2];
        if (!scale) scale = w * 1.4;
      }
      let motion = 0;
      if (s.ref && scale) {
        const d = [];
        for (const k in pts) if (s.ref.pts[k]) d.push(Math.hypot(pts[k][0] - s.ref.pts[k][0], pts[k][1] - s.ref.pts[k][1]) / scale);
        d.sort((a, b) => a - b);
        motion = d.length >= 2 ? d[Math.floor(d.length * 0.6)] : d.length ? d[0] : 0;
        if (Object.keys(pts).filter((k) => s.ref.pts[k]).length < Math.min(3, Object.keys(pts).length)) s.ref = null; // סט הנקודות השתנה
      }
      if (!s.ref) s.ref = { pts, scale };
      else if (motion > thr * 2 || (motion > thr && (s.motionHits = (s.motionHits || 0) + 1) >= 2)) { s.motionHits = 0; s.lastMotion = now; s.ref = { pts, scale }; onResponse(p, 'motion'); } // תנועה אמיתית, לא רעש של פריים בודד
      else if (motion <= thr) s.motionHits = 0;

      // ----- רעידות: הרבה תזוזה הלוך-חזור בלי להתקדם
      const tp = (body && (KP(body, 'leftWrist') || KP(body, 'rightWrist') || headPoint(body))) || pts.fc;
      if (tp && scale) {
        s.path.push({ t: now, x: tp[0] / scale, y: tp[1] / scale, x2: pts.fc ? pts.fc[0] / scale : tp[0] / scale, y2: pts.fc ? pts.fc[1] / scale : tp[1] / scale });
        while (s.path.length && now - s.path[0].t > 3000) s.path.shift();
        if (s.path.length >= 6) {
          let len = 0; for (let i = 1; i < s.path.length; i++) len += Math.hypot(s.path[i].x - s.path[i - 1].x, s.path[i].y - s.path[i - 1].y) + Math.hypot(s.path[i].x2 - s.path[i - 1].x2, s.path[i].y2 - s.path[i - 1].y2);
          const net = Math.hypot(s.path[s.path.length - 1].x - s.path[0].x, s.path[s.path.length - 1].y - s.path[0].y);
          const secs = (now - s.path[0].t) / 1000;
          const shaky = len / secs > 1.1 && net < len * 0.18;
          if (shaky) { if (!s.tremorSince) s.tremorSince = now; } else s.tremorSince = 0;
        }
      }

      // ----- נפילה: ירידה חדה של הראש + הגב עובר לשכיבה (התיישבות משאירה את הגב זקוף)
      const head = (body && headPoint(body)) || (tr ? [tr.box[0] + tr.box[2] / 2, tr.box[1] + tr.box[3] / 2] : null);
      const t = body ? torso(body) : null;
      if (head) {
        s.hist.push({ t: now, y: head[1], ang: t ? t.ang : null });
        while (s.hist.length && now - s.hist[0].t > 6000) s.hist.shift();
        if (t && t.ang < 35) s.upright = now;
        const recent = s.hist.filter((h) => now - h.t < 1500);
        const minY = Math.min(...recent.map((h) => h.y));
        const unit = s.torsoRef || (s.faceRef ? s.faceRef * 2.2 : 0);
        if (unit && head[1] - minY > unit * 1.1 && !s.dropAt) { s.dropAt = now; s.dropFaceOnly = !t; s.dropBase = minY; }
        if (t && t.ang > 65) { if (!s.lyingSince) s.lyingSince = now; } else s.lyingSince = 0;
      }
      if (R.fall.on && s.state === 'ok') {
        let fell = false, why = '';
        if (s.dropAt && now - s.dropAt < 2500 && t && t.ang > 50) { fell = true; why = 'ירידה חדה והגוף בשכיבה'; }
        if (s.dropAt && s.dropFaceOnly && now - s.dropAt > 3000 && head && head[1] - s.dropBase > (s.faceRef || 60) * 2) { fell = true; why = 'הראש ירד בחדות ונשאר למטה'; }
        if (envCfg().fallLying && !s.resting && s.lyingSince && now - s.lyingSince > 6000 && s.upright && s.lyingSince - s.upright < 15000) { fell = true; why = 'עבר מעמידה לשכיבה'; }
        if (fell && !s.fallCand) { s.fallCand = { t: now, why, snap: snapDataURL() }; s.dropAt = 0; s.lyingSince = 0; }
      }
      // אישור נפילה: מחכים 2.5 שניות — אם קם או התיישב זקוף, זו לא נפילה (למשל התכופף להרים משהו)
      if (s.fallCand) {
        if (t && t.ang < 35 && s.torsoRef && head && head[1] < (s.hist.length ? Math.min(...s.hist.map((h) => h.y)) + s.torsoRef * 0.6 : Infinity)) s.fallCand = null;
        else if (now - s.fallCand.t > 2500) { const c = s.fallCand; s.fallCand = null; trigger(p, 'fall', c.why); if (c.snap) { s.snapDetect = c.snap; s.snapDetectAt = c.t; } }
      }
      if (s.dropAt && now - s.dropAt > 3500) s.dropAt = 0;

      // ----- תנוחה, מנוחה במיטה/ספה, שכיבה על הרצפה
      const pos = body ? posture(body) : null, cpt = head || (tr ? [tr.box[0] + tr.box[2] / 2, tr.box[1] + tr.box[3] / 2] : null);
      const rz = cpt && pos === 'lying' ? restZone(cpt[0], cpt[1] + (s.torsoRef || 0) * 0.5) : null;
      s.resting = pos === 'lying' && (!!rz || !envCfg().fallLying);
      s.cur = { post: pos, cx: cpt ? cpt[0] : 0, cy: cpt ? cpt[1] : 0, scale: s.torsoRef || (s.faceRef ? s.faceRef * 2.2 : 100), zone: rz ? rz.id : '' };
      if (pos === 'lying' && !s.resting) { if (!s.floorSince) s.floorSince = now; } else s.floorSince = 0;
      if (R.floor && R.floor.on && s.state === 'ok' && s.floorSince && now - s.floorSince > R.floor.val * 1000) { s.floorSince = 0; trigger(p, 'floor', `שוכב מחוץ למיטה ולספה ${fmtSec(R.floor.val)}`); }
      // שינוי אחרי ש"זה בסדר": תנוחה אחרת או מקום אחר — חוזרים לשמור כרגיל
      if (s.okSig && s.cur.post) {
        const o = s.okSig, moved = o.cx && Math.hypot(s.cur.cx - o.cx, s.cur.cy - o.cy) > (o.scale || 100) * 1.5;
        if ((o.post && s.cur.post !== o.post) || moved || o.zone !== s.cur.zone) {
          const what = o.post && s.cur.post !== o.post ? `עכשיו ${POSTURE_NAMES[s.cur.post] || ''}` : 'זז למקום אחר';
          logSafety(p, 'notify', `שינוי אצל ${p.name}: ${what}`); if (['floor', 'fall', 'still'].includes(o.reason)) sendAlerts(p, 'info', `עדכון: ${p.name} ${what}. השמירה חזרה לרגיל.`);
          s.okSig = null; s.lastMotion = now;
        }
      }
      // ----- הרמת יד = "אני בסדר"
      if (body && handRaised(body)) { if (++s.handFrames >= 2) { onResponse(p, 'hand'); medGesture(p.id, 'הרים יד'); } } else s.handFrames = 0;
    }

    // ----- כללים מבוססי זמן
    if (s.state === 'ok') {
      if (R.still.on && present && !inSleepHours() && !(s.resting && !S.settings.stillWhileSleep) && now - s.lastMotion > R.still.val * 1000) trigger(p, 'still', `ללא תנועה ${fmtDur(now - s.lastMotion)}`);
      else if (R.tremor.on && s.tremorSince && now - s.tremorSince > R.tremor.val * 1000) { s.tremorSince = 0; trigger(p, 'tremor', `תנועה חזקה וחוזרת במשך ${fmtSec(R.tremor.val)}`); }
      else if (R.alone.on && isKid(p) && present && presentAdults === 0) { if (!s.aloneSince) s.aloneSince = now; if (now - s.aloneSince > R.alone.val * 1000) { s.aloneSince = 0; trigger(p, 'alone', `${p.name} לבד מול המצלמה ${fmtSec(R.alone.val)}`); } }
      else if (s.aloneSince && (presentAdults > 0 || !present)) s.aloneSince = 0;
    }
    const lastAny = Math.max(s.lastSeen, s.remoteSeen || 0); // נראה במצלמה אחרת בבית = לא "מחוץ לטווח"
    if (R.away.on && s.seenOnce && !present && (s.state === 'away' || s.state === 'ok') && now - lastAny > R.away.val * 1000) trigger(p, 'away', `לא נראה ${fmtDur(now - lastAny)}`);
    if (present && s.state === 'asking' && s.reason === 'away') onResponse(p, 'back');

    stepFlow(p, s, now, present, body, t0(body));
  }
}
const t0 = (b) => (b ? torso(b) : null);
function countAdults(now) {
  let n = 0; const seenP = new Set();
  for (const t of tracks) {
    if (now - t.seen > 1500) continue;
    const p = t.pid && byId(t.pid);
    if (p && p.name) { if (isAdult(p)) { n++; seenP.add(p.id); } }
    else if (t.face && t.face.age >= 18) n++;
  }
  for (const b of bodies) if (!b.pid) n++; // גוף בלי פנים מזוהות — ייתכן שזה מבוגר, לא מתריעים לשווא
  return n;
}

