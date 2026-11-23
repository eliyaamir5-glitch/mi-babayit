/* =========================================================
   חיישני שמע — עיבוד במכשיר בלבד, בלי הקלטה ובלי שליחה
   ========================================================= */
const SND_NAMES = { cry: 'בכי', scream: 'צעקה', loud: 'רעש חזק פתאומי', smoke: 'אזעקת עשן', glass: 'שבירת זכוכית', bark: 'נביחות' };
const ACT_NAMES = { notify: 'התראה', ask: 'לשאול "הכל טוב?"', emergency: 'חירום מיידי' };
Object.assign(REASON_NAMES, { cry: 'נשמע בכי', scream: 'נשמעה צעקה', loud: 'רעש חזק פתאומי', smoke: 'אזעקת עשן', glass: 'שבירת זכוכית', distress: 'מצוקה רגשית' });
const A = { on: false, stream: null, src: null, an: null, proc: null, sr: 48000, floor: -70, db: -90, rel: 0, frames: [], ring: null, ringPos: 0,
  cls: null, smartState: 'off', smartAt: 0, smart: {}, last: {}, screamRun: 0, cryBurst: [], wasCry: false, lastLoudRel: 0, meter: 0 };
const sndQuiet = () => speaking || Date.now() < speakingUntil || (!!siren && !sirenMuted) || Date.now() < (A.chimeUntil || 0) || !!SOOTHE.node; // לא לשמוע את המערכת עצמה

async function startAudio() {
  if (A.on) return true;
  if (A.starting) return A.starting;
  A.starting = startAudio2().finally(() => { A.starting = null; });
  return A.starting;
}
async function startAudio2() {
  try {
    A.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); await actx.resume();
    A.sr = actx.sampleRate;
    A.src = actx.createMediaStreamSource(A.stream);
    A.an = actx.createAnalyser(); A.an.fftSize = 2048; A.an.smoothingTimeConstant = 0;
    A.proc = actx.createScriptProcessor(4096, 1, 1);
    A.ring = new Float32Array(Math.round(A.sr * 1.0)); A.ringPos = 0;
    A.src.connect(A.an); A.src.connect(A.proc);
    const mute = actx.createGain(); mute.gain.value = 0; A.proc.connect(mute); mute.connect(actx.destination);
    A.freq = new Float32Array(A.an.frequencyBinCount);
    A.proc.onaudioprocess = (ev) => onAudio(ev.inputBuffer.getChannelData(0));
    A.on = true;
    if (S.settings.snd.engine !== 'basic') loadSmart();
    renderSoundStatus();
    return true;
  } catch (e) { console.warn('audio', e); toast(null, 'אין גישה למיקרופון', 'אשר הרשאת מיקרופון בדפדפן'); return false; }
}
function stopAudio() {
  if (!A.on) return;
  try { A.proc.disconnect(); A.src.disconnect(); A.stream.getTracks().forEach((t) => t.stop()); } catch (e) {}
  A.on = false; A.frames = []; renderSoundStatus();
}
async function loadSmart() {
  if (A.cls || A.smartState === 'loading') return;
  A.smartState = 'loading'; renderSoundStatus();
  try {
    const base = window.MIBABAYIT_MPA || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-audio@1.2.3';
    const mp = await import(base + '/audio_bundle.mjs');
    const fs = await mp.FilesetResolver.forAudioTasks(base + '/wasm');
    A.cls = await mp.AudioClassifier.createFromOptions(fs, { baseOptions: { modelAssetPath: window.MIBABAYIT_YAMNET || 'https://storage.googleapis.com/mediapipe-models/audio_classifier/yamnet/float32/1/yamnet.tflite' }, maxResults: 8, scoreThreshold: 0.1 });
    A.smartState = 'on';
  } catch (e) { console.warn('smart audio', e); A.smartState = 'fail'; }
  renderSoundStatus();
}
// תדר יסודי בשיטת אוטוקורלציה (על דגימה מוקטנת ל־16kHz)
function pitch(buf, sr) {
  const step = Math.max(1, Math.round(sr / 16000)), n = Math.floor(buf.length / step), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = buf[i * step];
  const fs = sr / step, minL = Math.floor(fs / 1000), maxL = Math.floor(fs / 180);
  let e0 = 0; for (let i = 0; i < n; i++) e0 += x[i] * x[i]; if (e0 < 1e-7) return [0, 0];
  let best = 0, bl = 0;
  for (let l = minL; l <= maxL; l++) { let c = 0; for (let i = 0; i < n - l; i++) c += x[i] * x[i + l]; c /= e0; if (c > best) { best = c; bl = l; } }
  return [bl ? fs / bl : 0, best];
}
function onAudio(buf) {
  // טבעת של שנייה אחרונה למנוע החכם
  for (let i = 0; i < buf.length; i++) { A.ring[A.ringPos] = buf[i]; A.ringPos = (A.ringPos + 1) % A.ring.length; }
  let ss = 0; for (let i = 0; i < buf.length; i++) ss += buf[i] * buf[i];
  const db = 10 * Math.log10(ss / buf.length + 1e-12);
  A.db = db;
  // רצפת רעש אדפטיבית: יורדת מהר, עולה לאט מאוד
  if (db < A.floor) A.floor = A.floor * 0.85 + db * 0.15; else A.floor += 0.015;
  A.floor = Math.max(-95, Math.min(-25, A.floor));
  const rel = db - A.floor; A.rel = rel; A.meter = A.meter * 0.7 + rel * 0.3;
  const now = Date.now();
  if (sndQuiet()) { A.frames = []; A.screamRun = 0; return; }
  const [f0, clar] = pitch(buf, A.sr);
  A.an.getFloatFrequencyData(A.freq);
  const binHz = A.sr / A.an.fftSize; let hi = 0, tot = 0;
  for (let i = Math.floor(100 / binHz); i < Math.min(A.freq.length, 8000 / binHz); i++) { const p = Math.pow(10, A.freq[i] / 10); tot += p; if (i * binHz >= 1000 && i * binHz <= 4000) hi += p; }
  const hiR = tot ? hi / tot : 0;
  const snd = S.settings.snd, th = snd.noiseDb;
  const frame = { t: now, rel, f0, clar, hiR };
  A.frames.push(frame); while (A.frames.length && now - A.frames[0].t > 8000) A.frames.shift();

  // רעש חזק פתאומי: קפיצה חדה מעל הסף
  // רעש חזק פתאומי = מכה קצרה (נפילת חפץ, טריקה): קפיצה חדה שנגמרת תוך חצי שנייה. קול מתמשך (בכי, דיבור) לא נחשב
  if (rel > th + 14 && A.lastLoudRel < th && !A.loudCand) A.loudCand = { t: now, rel };
  if (A.loudCand) {
    if (rel < th && now - A.loudCand.t <= 600) { if (snd.loud.on) soundEvent('loud', `מכה חזקה, ${Math.round(A.loudCand.rel)} דציבל מעל הרקע`); A.loudCand = null; }
    else if (now - A.loudCand.t > 600) A.loudCand = null;
  }
  A.lastLoudRel = rel;
  // צעקה: חזק מאוד, גבוה וצלול, לפחות כחצי שנייה
  const screamy = rel > th + 6 && clar > 0.35 && (f0 > 480 || hiR > 0.45);
  A.screamRun = screamy ? A.screamRun + buf.length / A.sr : 0;
  if (snd.scream.on && !A.cls && A.screamRun > 0.45) { A.screamRun = 0; soundEvent('scream', 'קול חזק וגבוה'); }
  // בכי: קול צלול בטווח 280–750Hz, בפרצים חוזרים, לאורך זמן
  const cryish = rel > th * 0.6 && f0 > 280 && f0 < 750 && clar > 0.5;
  if (cryish && !A.wasCry) A.cryBurst.push(now);
  A.wasCry = cryish; A.cryBurst = A.cryBurst.filter((t) => now - t < snd.cry.sec * 1000 + 2000);
  if (snd.cry.on && !A.cls) {
    const win = A.frames.filter((f) => now - f.t < snd.cry.sec * 1000);
    const ratio = win.length ? win.filter((f) => f.rel > th * 0.6 && f.f0 > 280 && f.f0 < 750 && f.clar > 0.5).length / win.length : 0;
    if (win.length > 8 && ratio > 0.4 && A.cryBurst.length >= 3 && now - A.frames[0].t >= snd.cry.sec * 1000 * 0.9) soundEvent('cry', `בכי במשך ${fmtSec(snd.cry.sec)}`);
  }
  // מנוע חכם: סיווג כל שנייה
  if (A.cls && now - A.smartAt > 1000) {
    A.smartAt = now;
    try {
      const pcm = new Float32Array(A.ring.length); pcm.set(A.ring.subarray(A.ringPos)); pcm.set(A.ring.subarray(0, A.ringPos), A.ring.length - A.ringPos);
      const res = A.cls.classify(pcm, A.sr);
      const cats = (res && res[0] && res[0].classifications && res[0].classifications[0] && res[0].classifications[0].categories) || [];
      A.lastCats = cats.slice(0, 3).map((c) => `${c.categoryName} ${Math.round(c.score * 100)}%`).join(', ');
      const hit = (re, min) => cats.some((c) => re.test(c.categoryName) && c.score >= min);
      const mark = (k, yes) => { A.smart[k] = yes ? (A.smart[k] || 0) + 1 : 0; return A.smart[k]; };
      if (mark('cry', hit(/Baby cry|infant cry|Crying, sobbing|Whimper/i, 0.3)) >= Math.max(2, Math.round(snd.cry.sec)) && snd.cry.on) soundEvent('cry', `בכי במשך ${fmtSec(snd.cry.sec)} (מנוע חכם)`);
      if (mark('scream', hit(/Scream|Yell|Shout|Children shouting/i, 0.35) && rel > th) >= 1 && snd.scream.on) soundEvent('scream', 'צעקה (מנוע חכם)');
      if (mark('smoke', hit(/Smoke detector|Fire alarm|Alarm/i, 0.35)) >= 2 && snd.smoke.on) soundEvent('smoke', 'נשמעה אזעקה (מנוע חכם)');
      if (mark('glass', hit(/Glass|Shatter|Breaking/i, 0.4)) >= 1 && snd.glass.on) soundEvent('glass', 'נשמעה שבירה (מנוע חכם)');
      if (mark('bark', hit(/Bark|Dog|Howl|Yip|Bow-wow/i, 0.35)) >= 4 && snd.bark && snd.bark.on) soundEvent('bark', 'נביחות ממושכות (מנוע חכם)');
    } catch (e) { console.warn(e); }
  }
}
function soundEvent(kind, detail) {
  const now = Date.now(), cfg = S.settings.snd[kind]; if (!cfg) return;
  if (now - (A.last[kind] || 0) < (S.settings.snd.cooldown || 60) * 1000) return; // לא להציף
  A.last[kind] = now;
  const all = guarded().filter((p) => !(p.guard.pausedUntil > now));
  const presentP = all.filter((p) => G[p.id] && now - G[p.id].lastSeen < 15000);
  // בכי משויך לתינוקות וילדים; צעקה לכל מי שבשמירה ונמצא כאן
  let targets = kind === 'cry' ? all.filter((p) => isKid(p)) : presentP.length ? presentP : all;
  if (kind === 'cry' && !targets.length) targets = presentP;
  let act = cfg.act || 'notify';
  if (!guardActive()) act = 'notify'; // בלי שמירה פעילה — רק התראה
  // בכי: קודם מנסים להרגיע בשיר ערש, ורק אם הבכי ממשיך — מתריעים
  if (kind === 'cry' && S.settings.snd.soothe && (!SOOTHE.last || now - SOOTHE.last > ((S.settings.snd.sootheMin || 5) + 2) * 60000)) {
    SOOTHE.last = now; sootheStart('lullaby', S.settings.snd.sootheMin || 5);
    logSafety(targets[0] || null, 'sound', `נשמע בכי — מנגן שיר ערש ל־${fmtSec((S.settings.snd.sootheMin || 5) * 60)}`);
    toast(targets[0] || null, '🎵 נשמע בכי', 'מנגן שיר ערש. אם הבכי ימשיך — תישלח התראה'); return;
  }
  logSafety(targets[0] || null, 'sound', `${REASON_NAMES[kind]} · ${detail}`, snapDataURL());
  if (act === 'notify' || !targets.length) return notifyEvent(targets[0] || null, kind, detail);
  for (const p of targets.slice(0, 3)) {
    if (act === 'emergency') { const s = gs(p.id); if (s.state !== 'emergency') { s.reason = kind; s.detail = detail; s.snapDetect = snapDataURL(); s.snapDetectAt = now; emergency(p); } }
    else trigger(p, kind, detail);
  }
}
function notifyEvent(p, kind, detail) {
  const title = `${REASON_NAMES[kind] || kind}${p ? ' · ' + p.name : ''}`;
  toast(p, title, detail || ''); chime('unk'); A.chimeUntil = Date.now() + 1500;
  if (S.settings.snd.speakNotify && p) speak(kind === 'cry' ? `${p.name} בוכה` : `שימו לב: ${REASON_NAMES[kind]}`, false);
  sendAlerts(p, 'notify', `${title}${detail ? ' · ' + detail : ''}`);
  renderGuard();
}
function renderSoundStatus() {
  const el = $('sndStatus'); if (!el) return;
  const smart = { off: '', loading: ' · טוען מנוע חכם...', on: ' · מנוע חכם פעיל', fail: ' · מנוע חכם לא נטען (פועל הבסיסי)' }[A.smartState] || '';
  el.textContent = A.on ? `מאזין${smart}` : (S.settings.snd.on ? 'יופעל עם המצלמה' : 'כבוי');
}
function syncAudio() { if (S.settings.snd.on && running) startAudio(); else stopAudio(); }

