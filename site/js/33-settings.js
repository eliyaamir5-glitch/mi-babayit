/* ---- confirm ---- */
function confirmBox(text, fn) {
  $('cfText').textContent = text; $('cfModal').classList.add('open');
  $('cfYes').onclick = () => { $('cfModal').classList.remove('open'); fn(); };
  $('cfNo').onclick = () => $('cfModal').classList.remove('open');
}

/* ---- settings ---- */
function syncSettings() {
  $('thr').value = S.settings.threshold;
  const t = S.settings.threshold;
  $('thrTxt').textContent = `${Math.round(t * 100)}% · ` + (t < 0.63 ? 'מקל — מזהה מהר, אבל עלול להתבלבל בין אנשים' : t > 0.74 ? 'מחמיר — כמעט בלי טעויות, אבל ייתכן שלא יזהה' : 'מאוזן (מומלץ)');
  $('qSel').value = S.settings.quality; $('eSel').value = S.settings.engine;
  $('engTxt').textContent = engineName ? `פועל כרגע: ${engineName}` : '';
  const st = S.settings;
  $('swGuard').classList.toggle('on', st.guardOn); $('sens').value = st.motionSens;
  $('sensTxt').textContent = `${st.motionSens}/10 · ` + (st.motionSens <= 3 ? 'רק תנועות גדולות נחשבות' : st.motionSens >= 8 ? 'גם תנועה קטנה נחשבת' : 'מאוזן');
  $('slFrom').value = st.sleepFrom; $('slTo').value = st.sleepTo; $('swSleep').classList.toggle('on', st.sleepOn);
  $('swVA').classList.toggle('on', st.voiceAnswer); $('vol').value = st.sirenVol; $('volTxt').textContent = Math.round(st.sirenVol * 100) + '%';
  $('swWake').classList.toggle('on', st.wakeLock); $('swNtfy').classList.toggle('on', st.ntfyOn);
  $('envGrid').innerHTML = Object.entries(ENVS).map(([k, e]) => `<button data-env="${k}" class="${st.env === k ? 'on' : ''}"><span>${e.icon}</span>${e.name}</button>`).join('');
  $('envNote').textContent = envCfg().note;
  $('swPriv').classList.toggle('on', !!st.privacy); $('swEmo').classList.toggle('on', !!st.emotions); $('swLook').classList.toggle('on', st.looks !== false); $('swBodySharp').classList.toggle('on', st.bodySharp !== false); $('swBodyDraw').classList.toggle('on', st.bodyDraw !== false);
  const sd = st.snd; $('swSnd').classList.toggle('on', sd.on); $('sndBody').classList.toggle('hidden', !sd.on);
  $('ndb').value = sd.noiseDb; $('ndbTxt').textContent = `${sd.noiseDb} דציבל מעל רעש הרקע · ` + (sd.noiseDb < 18 ? 'רגיש מאוד (חדר שקט)' : sd.noiseDb > 32 ? 'רק רעש חזק' : 'מאוזן');
  $('sndEng').value = sd.engine === 'basic' ? 'basic' : 'auto'; $('swSndSpeak').classList.toggle('on', !!sd.speakNotify);
  $('sndRules').innerHTML = Object.keys(SND_NAMES).map((k) => `<div class="srule" data-k="${k}"><button class="switch ${sd[k].on ? 'on' : ''}" data-a="on"></button><div class="rn">${SND_NAMES[k]}${k === 'smoke' || k === 'glass' || k === 'bark' ? '<small class="hint2" style="display:block;margin:0">רק במנוע החכם</small>' : ''}</div>
    ${k === 'cry' ? `<span class="hint2" style="margin:0">אחרי</span>${timeInput('data-a="sec"', sd.cry.sec, !sd[k].on, ['s', 'm'])}` : ''}
    <select class="field sm" data-a="act" ${sd[k].on ? '' : 'disabled'}>${Object.keys(ACT_NAMES).map((a) => `<option value="${a}" ${sd[k].act === a ? 'selected' : ''}>${ACT_NAMES[a]}</option>`).join('')}</select></div>`).join('');
  $('sndCoolW').innerHTML = timeInput('id="sndCool"', sd.cooldown, false, ['s', 'm']);
  renderSoundStatus();
  $('swRemote').classList.toggle('on', !!st.remoteOn); $('swSum').classList.toggle('on', !!st.summaryOn); $('sumAt').value = st.summaryAt || '21:00';
  $('hbUrl').value = st.heartbeat || ''; $('swSkel').classList.toggle('on', !!st.skeleton); $('swClips').classList.toggle('on', !!st.clips);
  $('swSoothe').classList.toggle('on', !!sd.soothe); $('sootheMin').value = sd.sootheMin || 5; $('sootheVol').value = st.sootheVol != null ? st.sootheVol : 0.35;
  $('stage').classList.toggle('skel', !!st.skeleton);
  $('remoteHelp').innerHTML = st.ntfyTopic ? `שליטה ממכשיר אחר: באפליקציית ntfy הירשם לערוץ <b dir="ltr">${esc(st.ntfyTopic)}-cmd</b> ושלח אליו: <b>מצב</b> (תמונה ומצב עכשיו), <b>סיכום</b>, <b>אני מטפל</b>, <b>בטל</b>, <b>השתק</b>, או <b>אמור</b> ואחריו טקסט שיוקרא בבית.` : 'הפעל ntfy כדי לקבל ערוץ.';
  $('vMode').value = st.verifyMode || 'smart'; $('vEsc').value = st.autoEscMin != null ? st.autoEscMin : 10; $('vRem').value = st.verifyRemind || 3;
  $('swVAsk').classList.toggle('on', st.verifyAsk !== false); $('swStillSleep').classList.toggle('on', !!st.stillWhileSleep);
  $('swArm').classList.toggle('on', !!st.armed); $('swArmAuto').classList.toggle('on', st.armAuto !== false); $('swArmSiren').classList.toggle('on', !!st.armSiren);
  $('swShowZones').classList.toggle('on', !!st.showZones); $('swDangerAll').classList.toggle('on', !!st.dangerAll);
  $('swPets').classList.toggle('on', !!(st.pets && st.pets.on)); $('petMiss').value = (st.pets && st.pets.missH) || 0; renderPets();
  $('camName').value = st.camName || ''; $('swSync').classList.toggle('on', !!st.syncOn); $('swSyncSiren').classList.toggle('on', !!st.syncSiren);
  const ac = st.a11yContact || {}; $('a11yName').value = ac.name || ''; $('a11yPhone').value = ac.phone || ''; $('a11yEmail').value = ac.email || '';
  $('ntfyTopic').value = st.ntfyTopic; $('webhook').value = st.webhook; $('swNotif').classList.toggle('on', st.notifOn); $('remind').value = st.remindMin;
  $('swVoice').classList.toggle('on', S.settings.voice);
  $('swSound').classList.toggle('on', S.settings.sound);
  $('stage').classList.toggle('mirror', S.settings.mirror);
}
$('setBtn').onclick = () => { syncSettings(); $('setModal').classList.add('open'); };
$('setClose').onclick = () => $('setModal').classList.remove('open');
$('thr').oninput = (e) => { S.settings.threshold = +e.target.value; syncSettings(); save(); };
$('qSel').onchange = async (e) => { S.settings.quality = e.target.value; save(); if (running) { stopCam(); await startCam(); } };
$('eSel').onchange = (e) => { S.settings.engine = e.target.value; save(); toast(null, 'נשמר', 'רענן את הדף כדי להחליף מנוע'); };
const tgl = (k, after) => () => { S.settings[k] = !S.settings[k]; save(); syncSettings(); if (after) after(); };
$('swGuard').onclick = tgl('guardOn', () => { if (!S.settings.guardOn) guarded().forEach((p) => { const s = G[p.id]; if (s && (s.state === 'emergency' || s.state === 'asking')) endEmergency(p, 'השמירה כובתה'); }); renderGuard(); });
$('sens').oninput = (e) => { S.settings.motionSens = +e.target.value; save(); syncSettings(); };
$('swSleep').onclick = tgl('sleepOn');
$('slFrom').onchange = (e) => { S.settings.sleepFrom = e.target.value; save(); };
$('slTo').onchange = (e) => { S.settings.sleepTo = e.target.value; save(); };
$('swVA').onclick = tgl('voiceAnswer', syncRec);
$('vol').oninput = (e) => { S.settings.sirenVol = +e.target.value; save(); syncSettings(); sirenLevel(); };
$('swWake').onclick = tgl('wakeLock', syncWake);
$('swNtfy').onclick = tgl('ntfyOn', () => { if (S.settings.ntfyOn && !S.settings.ntfyTopic) { S.settings.ntfyTopic = newTopic(); save(); syncSettings(); } syncCmd(); syncHouse(); });
$('ntfyTopic').onchange = (e) => { S.settings.ntfyTopic = e.target.value.trim().replace(/[^\w-]/g, ''); save(); syncSettings(); syncCmd(); syncHouse(); };
$('ntfyNew').onclick = () => { S.settings.ntfyTopic = newTopic(); save(); syncSettings(); syncCmd(); };
$('ntfyTest').onclick = () => { if (!S.settings.ntfyOn && !S.settings.webhook && !S.settings.notifOn) { toast(null, 'אין ערוץ פעיל', 'הפעל ntfy, Webhook או התראות דפדפן'); return; } sendAlerts(null, 'test'); };
$('webhook').onchange = (e) => { S.settings.webhook = e.target.value.trim(); save(); };
$('swNotif').onclick = async () => {
  if (!S.settings.notifOn && window.Notification) { try { const r = await Notification.requestPermission(); if (r !== 'granted') { toast(null, 'אין הרשאה', 'הדפדפן לא אישר התראות'); return; } } catch (e) {} }
  tgl('notifOn')();
};
$('remind').onchange = (e) => { S.settings.remindMin = Math.max(0, Math.min(60, +e.target.value || 0)); save(); };
$('voiceBtn').onclick = () => {
  const v = hebVoice();
  $('voiceTxt').textContent = v ? `נמצא קול עברי: ${v.name}` : 'לא נמצא קול עברי. ב־Windows: הגדרות › זמן ושפה › שפה › הוסף עברית עם "דיבור"';
  if (v) speak('שלום, אני מדבר עברית', true);
};
$('drillAll').onclick = () => {
  const p = guarded()[0];
  if (!p) { toast(null, 'אין אף אחד בשמירה', 'הפעל שמירה בפרופיל של אדם מוכר'); return; }
  if (!running) { toast(null, 'המצלמה כבויה', 'הפעל מצלמה כדי לתרגל'); return; }
  if (!S.settings.guardOn) { toast(null, 'השמירה כבויה', 'הפעל את מתג השמירה כדי לתרגל'); return; }
  $('setModal').classList.remove('open'); trigger(p, 'drill', 'תרגול חירום מלא');
};
$('envGrid').onclick = (e) => { const b = e.target.closest('[data-env]'); if (b) applyEnv(b.dataset.env); };
$('swPriv').onclick = tgl('privacy');
$('swEmo').onclick = tgl('emotions');
$('swBodySharp').onclick = () => { S.settings.bodySharp = S.settings.bodySharp === false; save(); syncSettings(); };
$('swBodyDraw').onclick = () => { S.settings.bodyDraw = S.settings.bodyDraw === false; save(); syncSettings(); };
$('swLook').onclick = () => { S.settings.looks = S.settings.looks === false; save(); syncSettings(); };
$('swSnd').onclick = () => { S.settings.snd.on = !S.settings.snd.on; save(); syncSettings(); syncAudio(); };
$('ndb').oninput = (e) => { S.settings.snd.noiseDb = +e.target.value; save(); syncSettings(); };
$('sndEng').onchange = (e) => { S.settings.snd.engine = e.target.value; save(); if (A.on && e.target.value !== 'basic') loadSmart(); if (e.target.value === 'basic') { A.cls = null; A.smartState = 'off'; } renderSoundStatus(); };
$('swSndSpeak').onclick = () => { S.settings.snd.speakNotify = !S.settings.snd.speakNotify; save(); syncSettings(); };
$('sndRules').onclick = (e) => { const b = e.target.closest('[data-a="on"]'); if (!b) return; const k = b.closest('.srule').dataset.k; S.settings.snd[k].on = !S.settings.snd[k].on; save(); syncSettings(); };
$('sndRules').onchange = (e) => {
  const k = e.target.closest('.srule').dataset.k;
  if (e.target.dataset.a === 'act') S.settings.snd[k].act = e.target.value;
  const w = e.target.closest('.tin'); if (w) S.settings.snd.cry.sec = Math.max(2, Math.min(600, Math.round(readTime(w)) || 4));
  save(); syncSettings();
};
$('sndCoolW').onchange = (e) => { const w = e.target.closest('.tin'); if (w) { S.settings.snd.cooldown = Math.max(5, Math.min(3600, Math.round(readTime(w)) || 60)); save(); } };
setInterval(() => { if (!$('setModal').classList.contains('open') || !A.on) return; const th = S.settings.snd.noiseDb; $('sndMeter').style.width = Math.max(0, Math.min(100, A.meter / 50 * 100)) + '%'; $('sndMark').style.left = (th / 50 * 100) + '%'; }, 120);
$('swRemote').onclick = tgl('remoteOn', syncCmd);
$('swSum').onclick = tgl('summaryOn');
$('sumAt').onchange = (e) => { S.settings.summaryAt = e.target.value || '21:00'; save(); };
$('hbUrl').onchange = (e) => { S.settings.heartbeat = e.target.value.trim(); save(); };
$('swSkel').onclick = tgl('skeleton');
$('swClips').onclick = tgl('clips', () => { if (S.settings.clips) recStart(); else recStop(); });
$('swSoothe').onclick = () => { S.settings.snd.soothe = !S.settings.snd.soothe; save(); syncSettings(); };
$('sootheMin').onchange = (e) => { S.settings.snd.sootheMin = Math.max(1, Math.min(60, +e.target.value || 5)); save(); };
$('sootheVol').oninput = (e) => { S.settings.sootheVol = +e.target.value; save(); if (SOOTHE.node) try { SOOTHE.node[0].gain.setTargetAtTime(S.settings.sootheVol, actx.currentTime, 0.2); } catch (er) {} };
$('stBtn').onclick = () => { $('setModal').classList.remove('open'); selfTest(); };
$('stClose').onclick = () => $('stModal').classList.remove('open');
$('clipClose').onclick = () => { $('clipModal').classList.remove('open'); $('clipBox').querySelectorAll('video').forEach((v) => { v.pause(); URL.revokeObjectURL(v.src); }); $('clipBox').innerHTML = ''; };
$('sumClose').onclick = () => $('sumModal').classList.remove('open');
$('sumSend').onclick = () => { sendAlerts(null, 'summary', dailySummary().join('\n')); toast(null, 'הסיכום נשלח', S.settings.ntfyOn ? 'בדוק את ntfy בטלפון' : 'הגדר ערוץ התראות כדי לקבל בטלפון'); };
['a11yName', 'a11yPhone', 'a11yEmail'].forEach((id) => { $(id).onchange = () => { S.settings.a11yContact = { name: $('a11yName').value.trim(), phone: $('a11yPhone').value.trim(), email: $('a11yEmail').value.trim(), date: new Date().toLocaleDateString('he-IL') }; save(); }; });
$('vMode').onchange = (e) => { S.settings.verifyMode = e.target.value; save(); if (e.target.value === 'smart' && !smartMode()) toast(null, 'צריך ערוץ לטלפון', 'הפעל ntfy ו"שליטה מרחוק" כדי שהאימות החכם יעבוד. עד אז — שואל את האדם ואז אזעקה'); };
$('vEsc').onchange = (e) => { S.settings.autoEscMin = Math.max(0, Math.min(120, +e.target.value || 0)); save(); };
$('vRem').onchange = (e) => { S.settings.verifyRemind = Math.max(1, Math.min(60, +e.target.value || 3)); save(); };
$('swVAsk').onclick = () => { S.settings.verifyAsk = S.settings.verifyAsk === false; save(); syncSettings(); };
$('swStillSleep').onclick = tgl('stillWhileSleep');
$('swArm').onclick = tgl('armed', () => { syncSend({ type: S.settings.armed ? 'arm' : 'disarm', name: 'ידני' }); renderGuard(); });
$('swArmAuto').onclick = () => { S.settings.armAuto = S.settings.armAuto === false; save(); syncSettings(); };
$('swArmSiren').onclick = tgl('armSiren');
$('swShowZones').onclick = tgl('showZones');
$('swDangerAll').onclick = tgl('dangerAll');
$('swPets').onclick = () => { S.settings.pets.on = !S.settings.pets.on; PET.objOK = true; save(); syncSettings(); };
$('petMiss').onchange = (e) => { S.settings.pets.missH = Math.max(0, Math.min(72, +e.target.value || 0)); save(); };
$('petAdd').onclick = () => { const n = $('petName').value.trim(); if (!n) { $('petName').focus(); return; } S.pets.push({ id: 'pet' + Date.now().toString(36), name: n, kind: $('petKind').value, added: Date.now() }); $('petName').value = ''; if (!S.settings.pets.on) S.settings.pets.on = true; save(); syncSettings(); toast(null, `${PET_KINDS[$('petKind').value].icon} ${n} נוסף`, 'זיהוי חיות המחמד הופעל'); };
$('camName').onchange = (e) => { S.settings.camName = e.target.value.trim() || S.settings.camName; save(); };
$('swSync').onclick = tgl('syncOn', syncHouse);
$('swSyncSiren').onclick = tgl('syncSiren');
$('shareProf').onclick = shareProfiles;
$('zoneBtn').onclick = () => zoneEdit(!ZE.on);
$('fsBtn').onclick = () => { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) {} };
$('swVoice').onclick = () => { S.settings.voice = !S.settings.voice; syncSettings(); save(); };
$('swSound').onclick = () => { S.settings.sound = !S.settings.sound; syncSettings(); save(); };
$('mirrorBtn').onclick = () => { S.settings.mirror = !S.settings.mirror; syncSettings(); save(); };
$('resetBtn').onclick = () => confirmBox('למחוק את כל האנשים ואת היומן?', () => { Object.keys(G).forEach(dropG); S.people = []; S.log = []; S.counter = 1; tracks = []; save(); render(); $('setModal').classList.remove('open'); });
$('expBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(S)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `mi-babayit-${new Date().toISOString().slice(0, 10)}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
$('impBtn').onclick = () => $('impFile').click();
$('impFile').onchange = async (e) => {
  try {
    const d = JSON.parse(await e.target.files[0].text());
    if (!Array.isArray(d.people)) throw 0;
    d.people.forEach((p) => { p.samples = (p.samples || []).map((x) => (Array.isArray(x) ? { e: Array.from(norm(x)), img: p.thumb, t: 0 } : x)); });
    S = Object.assign(S, d, { settings: Object.assign({}, S.settings, d.settings || {}) }); normalizeState(); Object.keys(G).forEach(dropG); save(); render(); syncSettings(); renderGuard(); toast(null, 'הגיבוי שוחזר', `${S.people.length} אנשים`);
  } catch (err) { toast(null, 'הקובץ לא תקין', 'בחר קובץ גיבוי של מי בבית'); }
  e.target.value = '';
};
$('snapBtn').onclick = () => {
  const c = document.createElement('canvas'); c.width = video.videoWidth; c.height = video.videoHeight;
  const g = c.getContext('2d');
  if (S.settings.mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(video, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
  if (S.settings.mirror) { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(canvas, 0, 0);
  const a = document.createElement('a'); a.href = c.toDataURL('image/jpeg', 0.92); a.download = `mi-babayit-${Date.now()}.jpg`; a.click();
};
$('startBtn').onclick = startCam; $('startBtn2').onclick = startCam;
$('stopBtn').onclick = stopCam;
setInterval(() => { if (!editingId) render(); }, 15000);

