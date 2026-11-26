/* ---------------- engine ---------------- */
function makeHuman(H, backend) {
  return new H({
    modelBasePath: LIB + 'models/',
    backend,
    debug: false,
    cacheSensitivity: 0, // כל קריאה מקבלת חיתוך אחר, אז אין שימוש חוזר בתוצאות
    filter: { enabled: true, equalization: false, flip: false },
    face: {
      enabled: true,
      detector: { rotation: true, maxDetected: 6, minConfidence: 0.45, return: false, skipFrames: 0, skipTime: 0 },
      mesh: { enabled: true },
      attention: { enabled: false }, iris: { enabled: false }, emotion: { enabled: false },
      description: { enabled: true, skipFrames: 0, skipTime: 0 },
      antispoof: { enabled: false }, liveness: { enabled: false },
    },
    body: { enabled: false }, hand: { enabled: false }, object: { enabled: false },
    gesture: { enabled: false }, segmentation: { enabled: false },
  });
}
async function initEngine() {
  const H = window.Human && (window.Human.Human || window.Human);
  if (!H) { setStatus('bad', 'לא הצלחתי לטעון את מנוע הזיהוי. בדוק חיבור לאינטרנט ורענן.'); return; }
  // מנסים קודם את WebGPU (מהיר יותר), ואם לא עובד — WebGL
  // ברירת המחדל היא WebGL — המנוע האמין. WebGPU מהיר יותר, אבל בחלק מהמחשבים הוא מחזיר זיהוי שגוי,
  // ולכן הוא רק לפי בחירה מפורשת בהגדרות, ורק אם עבר את בדיקת השפיות.
  const order = (S.settings.engine === 'webgpu' && navigator.gpu) ? ['webgpu', 'webgl'] : ['webgl'];
  for (const be of order) {
    try {
      if (be === 'webgpu') { const ad = await navigator.gpu.requestAdapter(); if (!ad) throw new Error('no adapter'); }
      human = makeHuman(H, be);
      setProg(15);
      await human.load(); setProg(65);
      const warm = await human.warmup(); setProg(100);
      const real = human.tf.getBackend();
      if (be === 'webgpu' && real !== 'webgpu') throw new Error('fallback');
      // בדיקת שפיות: תמונת הבדיקה המובנית של המנוע מכילה פנים אחדות במקום ידוע. מנוע שלא מוצא אותן — לא אמין.
      engineCheck = engineSane(warm);
      if (!engineCheck.ok && be !== order[order.length - 1]) throw new Error('sanity: ' + engineCheck.why);
      engineName = real === 'webgpu' ? 'WebGPU' : 'WebGL';
      setStatus('idle', 'מוכן — לחץ "הפעל מצלמה"');
      $('startBtn').disabled = false; $('startBtn2').disabled = false;
      setTimeout(() => $('prog').classList.add('hidden'), 400);
      listCameras();
      return;
    } catch (e) { console.warn('engine', be, e); }
  }
  setStatus('bad', 'טעינת המודלים נכשלה. בדוק חיבור לאינטרנט ורענן.');
}
let engineName = '', engineCheck = { ok: null, why: 'לא נבדק' };
function engineSane(r) {
  const fs = (r && r.face) || [];
  if (fs.length !== 1) return { ok: false, why: `נמצאו ${fs.length} פנים בתמונת הבדיקה במקום 1` };
  const f = fs[0], b = f.box || [0, 0, 0, 0];
  if (!f.embedding || !f.embedding.length) return { ok: false, why: 'אין חתימת פנים' };
  if (Math.abs(b[0] - 533) > 40 || Math.abs(b[1] - 53) > 40 || Math.abs(b[2] - 121) > 40) return { ok: false, why: `הפנים נמצאו במקום שגוי (${b.map(Math.round).join(',')})` };
  if ((f.boxScore || f.score || 0) < 0.6) return { ok: false, why: 'ודאות נמוכה בתמונת הבדיקה' };
  return { ok: true, why: 'תקין' };
}
function setProg(v) { $('progBar').style.width = v + '%'; }
function setStatus(kind, text) {
  $('sDot').className = 'dot' + (kind === 'on' ? ' on' : kind === 'load' ? ' load' : '');
  $('sText').textContent = text;
}
async function listCameras() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    const sel = $('camSel'); sel.innerHTML = '';
    devs.forEach((d, i) => { const o = document.createElement('option'); o.value = d.deviceId; o.textContent = d.label || `מצלמה ${i + 1}`; sel.appendChild(o); });
    sel.classList.toggle('hidden', devs.length < 2);
  } catch (e) {}
}
async function startCam() {
  // באייפון: חייבים "לפתוח" שמע ודיבור מיד בלחיצה, לפני כל המתנה
  try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); const b = actx.createBuffer(1, 1, 22050), src = actx.createBufferSource(); src.buffer = b; src.connect(actx.destination); src.start(0); } catch (e) {}
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) {}
  const gen = ++loopGen;
  try {
    const id = $('camSel').value;
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: Object.assign(id ? { deviceId: { exact: id } } : { facingMode: 'user' }, { width: { ideal: QUALITY[S.settings.quality] || 640 }, height: { ideal: Math.round((QUALITY[S.settings.quality] || 640) * 9 / 16) }, frameRate: { ideal: 30 } }),
    });
    video.srcObject = stream;
    await new Promise((r) => (video.readyState >= 2 ? r() : (video.onloadeddata = r)));
    await video.play();
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    video.onresize = () => { if (video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; } }; // סיבוב טלפון
    running = true;
    $('intro').classList.add('hidden'); $('hud').classList.remove('hidden'); $('startBtn2').classList.add('hidden'); $('stage').classList.add('running');
    ['stopBtn', 'mirrorBtn', 'snapBtn'].forEach((b) => $(b).classList.remove('hidden'));
    $('fpsPill').style.display = '';
    $('hudCam').textContent = (stream.getVideoTracks()[0].label || 'מצלמה') + ' · ' + video.videoWidth + 'x' + video.videoHeight + ' · ' + engineName;
    setStatus('on', 'סורק');
    listCameras();
    try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch (e) {}
    try { speechSynthesis.getVoices(); } catch (e) {}
    syncWake(); renderGuard(); syncAudio(); recStart(); syncCmd(); syncHouse(); $('zoneBtn').classList.remove('hidden');
    guarded().forEach((p) => { const s = gs(p.id); if (s.state !== 'emergency') freshG(s, Date.now()); });
    detectLoop(gen); drawLoop();
  } catch (e) {
    console.error(e);
    toast(null, 'אין גישה למצלמה', 'אשר הרשאת מצלמה בדפדפן ונסה שוב');
  }
}
function stopCam() {
  running = false;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; video.srcObject = null; tracks = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  $('intro').classList.remove('hidden'); $('hud').classList.add('hidden'); $('startBtn2').classList.remove('hidden'); $('stage').classList.remove('running');
  ['stopBtn', 'mirrorBtn', 'snapBtn'].forEach((b) => $(b).classList.add('hidden'));
  $('fpsPill').style.display = 'none';
  bodies = []; syncWake(); syncRec(); renderGuard(); syncAudio(); recStop(); syncCmd(); syncHouse(); zoneEdit(false); $('zoneBtn').classList.add('hidden'); PET.obs = [];
  guarded().forEach((p) => { const s = G[p.id]; if (s && s.state === 'asking') { s.state = 'ok'; } });
  setStatus('idle', 'המצלמה כבויה'); render();
}

