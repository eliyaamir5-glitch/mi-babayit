/* ---------- תהליך בדיקה וחירום ---------- */
const HOW = { motion: 'זוהתה תנועה', hand: 'הרים יד', speech: 'ענה בקול', button: 'אושר בלחיצה', back: 'חזר לטווח המצלמה', up: 'קם', adult: 'מבוגר הגיע', manual: 'בוטל ידנית' };
function phrase(p, i, reason) {
  const n = p.name, f = p.gender === 'f';
  if (reason === 'away') return [`${n}, איפה ${f ? 'את' : 'אתה'}? הכל טוב?`, `${n}, ${f ? 'את' : 'אתה'} שומע${f ? 'ת' : ''} אותי? תגיד${f ? 'י' : ''} כן אם הכל בסדר`, `${n}! תחזור${f ? 'י' : ''} בבקשה למצלמה או תגיד${f ? 'י' : ''} בסדר`][i % 3];
  const L = [
    `הכל טוב, ${n}?`,
    `${n}, ${f ? 'את' : 'אתה'} בסדר? תזוז${f ? 'י' : ''} או תרים${f ? 'י' : ''} יד`,
    `${n}, אני שואל שוב. הכל בסדר? תגיד${f ? 'י' : ''} כן`,
    `${n}! תעני לי בבקשה. הכל טוב?`.replace('תעני', f ? 'תעני' : 'תענה'),
    `${n}, אם ${f ? 'את' : 'אתה'} בסדר, תרים${f ? 'י' : ''} יד או תגיד${f ? 'י' : ''} בסדר`,
    `${n}, זו השאלה האחרונה. הכל טוב?`,
  ];
  return L[i % L.length];
}
// צילום מצב: תמונה מהמצלמה עם המסגרות והשלד, כדי שיהיה ברור מה קרה
function snapDataURL(w = 480, withOverlay = true) {
  if (envCfg().privacy) return null;
  const W = video.videoWidth, H = video.videoHeight; if (!W) return null;
  const sc = Math.min(1, w / W), c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
  const g = c.getContext('2d'); if (S.settings.mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
  if (S.settings.skeleton) { g.fillStyle = '#0b0e16'; g.fillRect(0, 0, c.width, c.height); } else g.drawImage(video, 0, 0, c.width, c.height);
  if (withOverlay) g.drawImage(canvas, 0, 0, c.width, c.height);
  g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, c.height - 22, c.width, 22);
  g.fillStyle = '#fff'; g.font = '13px Heebo, Arial'; g.textAlign = 'right'; g.direction = 'rtl';
  g.fillText(`מי בבית · ${new Date().toLocaleString('he-IL')}`, c.width - 8, c.height - 7);
  try { return c.toDataURL('image/jpeg', 0.72); } catch (e) { return null; }
}
const VERIFY_REASONS = ['still', 'floor', 'fall', 'away', 'distress', 'tremor', 'checkin', 'alone'];
const FAMILY = { still: 'body', floor: 'body', fall: 'body', tremor: 'body' };
const smartMode = () => S.settings.verifyMode !== 'local' && S.settings.ntfyOn && !!S.settings.ntfyTopic && S.settings.remoteOn;
function trigger(p, reason, detail) {
  if (!guardActive()) return;
  const s = gs(p.id);
  if (s.state === 'asking' || s.state === 'emergency' || s.state === 'verify') return;
  // האחראי כבר אמר "זה בסדר" על המצב הזה — שותקים עד שיהיה שינוי
  if (s.okSig && reason !== 'drill' && (s.okSig.reason === reason || (FAMILY[reason] && FAMILY[reason] === FAMILY[s.okSig.reason]))) { s.lastMotion = Date.now(); return; }
  s.clipId = wantClip();
  s.reason = reason; s.detail = detail || ''; s.triggeredAt = Date.now();
  s.snapDetect = snapDataURL(); s.snapDetectAt = Date.now();
  logSafety(p, reason === 'drill' ? 'drill' : 'detect', `${REASON_NAMES[reason]}${detail ? ' · ' + detail : ''}`, s.snapDetect, s.clipId);
  if (smartMode() && VERIFY_REASONS.includes(reason)) return verifyStart(p);
  const cfg = askCfg(p);
  if (cfg.skip || reason === 'alone') return emergency(p);
  s.state = 'asking'; s.askN = 0; s.nextAsk = Date.now();
  renderGuard();
}
/* ----- אימות חכם: שולחים לאחראי "זה בסדר?" במקום להפעיל אזעקה מיד ----- */
function verifyStart(p) {
  const s = gs(p.id), now = Date.now();
  s.state = 'verify'; s.vAt = now; s.vRem = now; s.vAsked = false; s.vSent = true;
  logSafety(p, 'ask', `נשלח לאחראי לאישור: ${REASON_NAMES[s.reason]}`);
  sendAlerts(p, 'verify');
  syncSend({ type: 'verify', name: p.name, reason: s.reason });
  toast(p, `❓ ${p.name}: ${REASON_NAMES[s.reason]}`, 'נשלח לטלפון של האחראי לאישור'); chime('unk'); A.chimeUntil = Date.now() + 1500;
  renderGuard(); syncRec();
}
function verifyOk(p, by) {
  const s = gs(p.id); if (s.state !== 'verify' && s.state !== 'emergency') return;
  const wasEm = s.state === 'emergency';
  s.okSig = Object.assign({ reason: s.reason, t: Date.now() }, s.cur || {});
  s.state = 'ok'; s.lastMotion = Date.now(); s.ref = null; s.floorSince = 0; s.tremorSince = 0; s.dropAt = 0; s.lyingSince = 0; s.fallCand = null; s.askN = 0;
  if (s.schedKey && S.sched[s.schedKey]) { S.sched[s.schedKey].st = 'ok'; s.schedKey = null; } s.vSent = false;
  logSafety(p, 'resolved', `${by}: מצב רגיל (${REASON_NAMES[s.reason]}) — לא אתריע שוב עד שיהיה שינוי`);
  if (wasEm) { afterEmergencyChange(); syncSend({ type: 'resolved', name: p.name }); }
  sendAlerts(p, 'info', `סומן כמצב רגיל: ${p.name} · ${REASON_NAMES[s.reason]}. תקבלו התראה רק אם יהיה שינוי.`);
  toast(p, `✅ ${p.name}: מצב רגיל`, 'לא אתריע שוב עד שיהיה שינוי'); renderGuard(); syncRec();
}
function verifyAlarm(p, by) {
  const s = gs(p.id); if (s.state === 'emergency') return;
  logSafety(p, 'emergency', `${by} הפעיל אזעקה: ${REASON_NAMES[s.reason] || ''}`);
  emergency(p);
}
// תנוחה: עומד / יושב / מתכופף / שוכב
const POSTURE_NAMES = { lying: 'שוכב', sitting: 'יושב', standing: 'עומד', bent: 'מתכופף' };
function posture(b) {
  const t = torso(b); if (!t) return null;
  if (t.ang > 60) return 'lying';
  const hp = KP(b, 'leftHip') || KP(b, 'rightHip'), kn = KP(b, 'leftKnee') || KP(b, 'rightKnee');
  if (t.ang < 40 && hp && kn && Math.abs(kn[1] - hp[1]) < t.len * 0.45) return 'sitting';
  return t.ang < 40 ? 'standing' : 'bent';
}
function restZone(x, y) { return S.zones.find((z) => (z.type === 'bed' || z.type === 'couch') && inZone(z, x, y)); }
function stepFlow(p, s, now, present, body, t) {
  const cfg = askCfg(p);
  if (s.state === 'verify') {
    if (S.settings.verifyAsk !== false && !s.vAsked && now - s.vAt > 4000 && present) { s.vAsked = true; speak(phrase(p, 0, s.reason), false); }
    const rem = (S.settings.verifyRemind || 3) * 60000;
    if (now - s.vRem > rem) { s.vRem = now; sendAlerts(p, 'verify', 'תזכורת'); }
    let esc2 = S.settings.autoEscMin != null ? S.settings.autoEscMin : 10;
    if (esc2 && (s.reason === 'fall' || s.reason === 'tremor')) esc2 = Math.min(esc2, 5);
    if (esc2 && now - s.vAt > esc2 * 60000) { logSafety(p, 'emergency', `אף אחד לא אישר תוך ${fmtSec(esc2 * 60)} — מפעיל אזעקה`); emergency(p); }
    if (s.reason === 'alone' && countAdults(now) > 0) return resolve(p, 'adult');
  }
  if (s.state === 'asking') {
    if (s.reason === 'alone' && countAdults(now) > 0) return resolve(p, 'adult');
    if (now >= s.nextAsk) {
      if (s.askN < cfg.n) { speak(phrase(p, s.askN, s.reason), true); logSafety(p, 'ask', `שאלה ${s.askN + 1} מתוך ${cfg.n}`); s.askN++; s.nextAsk = now + cfg.gap * 1000; renderGuard(); }
      else emergency(p);
    }
  }
  if (s.state === 'emergency') {
    if (s.reason === 'alone' && countAdults(now) > 0) return resolve(p, 'adult');
    if (now - s.lastCall > 9000 && !speaking) { s.lastCall = now; speak(s.reason === 'alone' ? `שימו לב! ${p.name} לבד` : `${p.name}! ${p.name}! ${p.gender === 'f' ? 'את' : 'אתה'} בסדר?`, false); }
    if (navigator.vibrate && now - (s.lastVib || 0) > 3000) { s.lastVib = now; try { navigator.vibrate([600, 200, 600, 200, 600]); } catch (e) {} }
    const rm = S.settings.remindMin || 0;
    if (rm && !s.acked && now - s.lastRemind > rm * 60000) { s.lastRemind = now; sendAlerts(p, 'remind'); }
  }
  if ((s.state === 'asking' || s.state === 'emergency' || s.state === 'verify') && (s.reason === 'fall' || s.reason === 'floor') && t && t.ang < 30 && body && headPoint(body)) { if (++s.upFrames >= 4) resolve(p, 'up'); } else s.upFrames = 0;
}
function onResponse(p, how) {
  const s = G[p.id]; if (!s || (s.state !== 'asking' && s.state !== 'emergency' && s.state !== 'verify')) return;
  // תנועה רגילה לא מבטלת חשד לנפילה או לרעידות — שם צריך יד, קול, כפתור או קימה
  if (how === 'motion' && !['still', 'away', 'drill', 'checkin'].includes(s.reason)) return;
  if (how === 'back' && s.reason !== 'away') return;
  resolve(p, how);
}
function resolve(p, how) {
  const s = gs(p.id); const wasEm = s.state === 'emergency', wasV = s.state === 'verify' && s.vSent; const drill = s.reason === 'drill'; s.vSent = false;
  s.state = 'ok'; s.lastMotion = Date.now(); s.ref = null; s.askN = 0; s.tremorSince = 0; s.aloneSince = 0; s.dropAt = 0; s.lyingSince = 0; s.clipId = null; s.acked = 0;
  if (s.schedKey && S.sched[s.schedKey]) { S.sched[s.schedKey].st = 'ok'; s.schedKey = null; }
  logSafety(p, 'resolved', `${drill ? 'תרגול: ' : ''}${HOW[how] || how}`);
  if (wasEm) syncSend({ type: 'resolved', name: p.name });
  if (wasEm) { sendAlerts(p, 'resolved', HOW[how]); }
  else if (wasV) sendAlerts(p, 'info', `${p.name} בסדר: ${HOW[how] || how}. אין צורך לאשר.`);
  afterEmergencyChange();
  if (how !== 'manual') speak(drill ? `התרגול הצליח. כל הכבוד ${p.name}` : `מעולה, תודה ${p.name}. אני ממשיך לשמור ${p.gender === 'f' ? 'עלייך' : 'עליך'}`, true);
  toast(p, drill ? 'התרגול הצליח' : `${p.name} בסדר`, HOW[how] || '');
  renderGuard();
}
function emergency(p) {
  const s = gs(p.id); if (s.state === 'emergency') return;
  s.state = 'emergency'; s.emAt = Date.now(); s.lastRemind = Date.now(); s.lastCall = 0;
  s.snapEm = snapDataURL(); if (!s.snapDetect) { s.snapDetect = s.snapEm; s.snapDetectAt = Date.now(); }
  if (!s.clipId) s.clipId = wantClip(); s.acked = 0;
  if (s.schedKey && S.sched[s.schedKey]) { S.sched[s.schedKey].st = 'missed'; s.schedKey = null; }
  logSafety(p, 'emergency', `${s.reason === 'drill' ? 'תרגול · ' : ''}${REASON_NAMES[s.reason]}`, s.snapEm, s.clipId);
  sendAlerts(p, 'emergency'); syncSend({ type: 'emergency', name: p.name, reason: s.reason });
  afterEmergencyChange();
  renderGuard();
}
function endEmergency(p, text) { const s = gs(p.id); s.state = 'ok'; s.lastMotion = Date.now(); s.ref = null; logSafety(p, 'cancel', text || 'בוטל'); afterEmergencyChange(); renderGuard(); }
function afterEmergencyChange() {
  const em = Object.keys(G).some((k) => G[k].state === 'emergency');
  if (em) sirenStart(); else { sirenStop(); sirenMuted = false; try { navigator.vibrate && navigator.vibrate(0); } catch (e) {} }
  document.body.classList.toggle('em', em);
  renderEmergency(); syncRec();
}

