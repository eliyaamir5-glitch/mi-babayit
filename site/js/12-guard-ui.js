/* ---------- ממשק השמירה ---------- */
function renderEmergency(clipReady) {
  const pid = Object.keys(G).find((k) => G[k].state === 'emergency');
  const el = $('emOverlay');
  if (!pid) { el.classList.remove('open'); $('emBack').classList.add('hidden'); return; }
  const p = byId(pid), s = G[pid]; if (!p) { dropG(pid); return; }
  if (el.dataset.hiddenFor === pid + ':' + s.emAt) { el.classList.remove('open'); $('emBack').classList.remove('hidden'); return; }
  $('emBack').classList.add('hidden');
  el.classList.add('open');
  $('emImg').src = p.thumb; $('emName').textContent = p.name;
  $('emReason').textContent = (s.reason === 'drill' ? 'תרגול · ' : '') + REASON_NAMES[s.reason] + (s.detail ? ' · ' + s.detail : '');
  $('emSince').textContent = fmtDur(Date.now() - s.lastMotion);
  $('emInstr').textContent = p.emInstr || 'לא הוגדרו הוראות חירום';
  const priv = envCfg().privacy;
  const key = pid + ':' + (s.snapDetectAt || 0) + ':' + priv;
  if ($('emSnaps').dataset.key !== key) { $('emSnaps').dataset.key = key; $('emSnaps').innerHTML = priv ? `<figure><div class="priv">מצב פרטיות: בלי תמונות בסביבה הזו</div></figure>` : `<figure data-lb="1"><img id="emSnap1" src="${s.snapDetect || ''}"><figcaption>רגע הזיהוי · ${s.snapDetectAt ? hhmm(s.snapDetectAt) : ''}</figcaption></figure><figure data-lb="2"><img id="emSnap2" src="${$('emSnap2') && $('emSnap2').src || s.snapEm || ''}"><figcaption>מצלמה עכשיו</figcaption></figure>`; }
  if (!priv && running && Date.now() - (s.liveSnapAt || 0) > 2000) { s.liveSnapAt = Date.now(); const u = snapDataURL(480); if (u) $('emSnap2').src = u; }
  const meds = CONDS.filter((c) => p.conds && p.conds[c.id]).map((c) => c.id === 'allergy' && p.allergyNote ? `אלרגיה (${p.allergyNote})` : c.id === 'other' && p.condOther ? p.condOther : c.name);
  $('emClip').classList.toggle('hidden', !(s.clipId && S.clips && S.clips.includes(s.clipId + ':a')));
  $('emClip').onclick = () => openClip(s.clipId);
  $('emMed').textContent = meds.length ? `מצב רפואי: ${meds.join(' · ')}` : '';
  const ph = p.emContact && p.emContact.phone;
  $('emCall').classList.toggle('hidden', !ph);
  if (ph) { $('emCall').href = 'tel:' + ph.replace(/[^\d+]/g, ''); $('emCallTxt').innerHTML = `התקשר ל${esc(p.emContact.name || 'איש הקשר')} · <bdi dir="ltr">${esc(ph)}</bdi>`; }
  $('emMute').textContent = sirenMuted ? 'הפעל סירנה' : 'השתק סירנה';
  const others = Object.keys(G).filter((k) => k !== pid && G[k].state === 'emergency').length;
  $('emMore').textContent = others ? `+ עוד ${others} במצב חירום` : '';
  el.dataset.pid = pid;
}
function guardCard(p) {
  const s = gs(p.id), R = effRules(p), now = Date.now();
  const paused = p.guard.pausedUntil && p.guard.pausedUntil > now;
  const st = paused ? 'paused' : s.state;
  const still = now - s.lastMotion;
  const pct = R.still.on ? Math.min(100, still / (R.still.val * 1000) * 100) : 0;
  const rules = Object.keys(R).filter((k) => R[k].on).map((k) => RULES[k].name + (RULES[k].timed ? ` ${fmtSec(R[k].val)}` : '')).join(' · ') || 'אין כללים פעילים';
  const meds = CONDS.filter((c) => p.conds && p.conds[c.id]).map((c) => c.name).join(', ');
  return `<div class="gcard st-${st}" data-id="${p.id}">
    <div class="gtop"><img src="${p.thumb}"><div class="ginfo"><b>${esc(p.name)} <span class="gemo">${emoLabel(p.id)}${s.resting ? ' 😴 נח' : s.cur && s.cur.post && now - s.lastSeen < 5000 ? ' · ' + POSTURE_NAMES[s.cur.post] : ''}${s.okSig ? ' · סומן כרגיל' : ''}</span></b><small>${AGE_NAMES[ageGroupOf(p)]}${meds ? ' · ' + esc(meds) : ''}</small></div>
      <span class="gstate">${STATE_NAMES[st]}${st === 'asking' ? ` ${s.askN}/${askCfg(p).n}` : ''}</span></div>
    ${R.still.on ? `<div class="gbar"><i style="width:${pct}%"></i></div><div class="gsub">ללא תנועה ${fmtDur(still)} מתוך ${fmtSec(R.still.val)}${inSleepHours() ? ' · שעות שינה' : ''}</div>`
      : `<div class="gsub">${s.seenOnce ? (now - s.lastSeen < 5000 ? 'נראה עכשיו' : 'נראה ' + ago(s.lastSeen)) : 'עוד לא נראה מאז ההפעלה'} · תנועה אחרונה לפני ${fmtDur(still)}</div>`}
    ${paused ? `<div class="gsub">מושהה עד ${hhmm(p.guard.pausedUntil)}</div>` : ''}
    <div class="grules">${esc(rules)}</div>
    <div class="gbtns"><button data-a="ok">בסדר</button><button data-a="pause">${paused ? 'חדש שמירה' : 'השהה לשעה'}</button><button data-a="drill">תרגול</button><button data-a="cfg">הגדרות</button></div>
  </div>`;
}
const EV_ICON = { sound: '🔊', notify: '🔔', device: '📟', detect: '⚠️', ask: '🗣️', emergency: '🚨', resolved: '✅', cancel: '✖️', drill: '🧪', start: '🛡️', stop: '⏸️', pause: '⏸️' };
function renderGuard() {
  if (!$('p-guard')) return;
  const list = guarded(), on = S.settings.guardOn;
  const em = list.filter((p) => G[p.id] && G[p.id].state === 'emergency').length;
  const ask = list.filter((p) => G[p.id] && G[p.id].state === 'asking').length;
  $('tG').textContent = list.length; $('tG').classList.toggle('hot', em + ask > 0);
  $('stGuard').textContent = on ? list.length : 0;
  const pill = $('gPill');
  pill.classList.toggle('hidden', !list.length);
  pill.className = 'pill gpill' + (!list.length ? ' hidden' : '') + (em ? ' em' : ask ? ' ask' : on && running ? ' on' : '');
  $('gPillTxt').textContent = !on ? 'שמירה כבויה' : !running ? 'שמירה: המצלמה כבויה' : em ? `חירום (${em})` : ask ? 'בודק...' : `שמירה פעילה · ${list.length}`;
  // באנר על הווידאו
  const ap = list.find((p) => G[p.id] && G[p.id].state === 'emergency') || list.find((p) => G[p.id] && G[p.id].state === 'asking') || list.find((p) => G[p.id] && G[p.id].state === 'verify');
  const bn = $('gBanner');
  if (ap && running) { const s = G[ap.id]; bn.className = 'gbanner ' + s.state; bn.textContent = s.state === 'emergency' ? `🚨 חירום: ${ap.name} · ${REASON_NAMES[s.reason]}` : s.state === 'verify' ? `❓ ממתין לאישור האחראי: ${ap.name} · ${REASON_NAMES[s.reason]}` : `🗣️ שואל את ${ap.name}: הכל טוב? (${s.askN}/${askCfg(ap).n})`; }
  else bn.className = 'gbanner hidden';
  if (editingId) return;
  const pane = $('p-guard');
  if (guardTouch && Date.now() - guardTouch < 1500) return; // לא מחליפים כפתורים באמצע לחיצה
  if (!pane.firstElementChild || !$('gTop')) {
    pane.innerHTML = `<div id="gTop"></div>
      <div class="gtools"><button data-t="test">🩺 בדיקת מערכת</button><button data-t="sum">📋 סיכום היום</button><button data-t="lull">🎵 שיר ערש</button><button data-t="noise">🌊 רעש לבן</button><button data-t="arm">🔒 בית ריק</button><button data-t="arr">🚪 הגעה צפויה</button><button data-t="zones">📍 אזורים</button><button data-t="cams">📷 מצלמות</button></div>
      <div class="gnote">⚠️ כלי עזר בלבד. לא מכשיר רפואי ולא תחליף להשגחה. במצב חירום אמיתי התקשרו מיד למד"א <b>101</b>.</div>
      <div id="gCards"></div>
      <div class="hint2" style="margin:10px 4px">כשהחלון ברקע או שהמסך כבוי, המעקב איטי או נעצר. לתוצאות הכי טובות השאר את החלון פתוח וגלוי, והטלפון מחובר לחשמל.</div>
      <div class="grp"><span>יומן אירועי בטיחות</span><span id="gLogN"></span></div>
      <div id="gLog"></div>`;
    guardLogKey = '';
  }
  $('gTop').innerHTML = heroCard() + arrivalsCard() + camsCard() + `<div class="devline">${devLine()}</div>
    <div class="set-row" style="padding:10px 4px"><div><b>שמירה</b><small>${on ? (running ? 'פעילה — המצלמה עוקבת' : 'תופעל כשהמצלמה תפעל') : 'כבויה לכולם'}</small></div><button class="switch ${on ? 'on' : ''}" id="gMaster"></button></div>`;
  $('gCards').innerHTML = list.length ? list.map(guardCard).join('') : `<div class="empty">🛡️<br>אף אחד לא בשמירה.<br>פתח פרופיל של אדם מוכר והפעל "שמירה פעילה".</div>`;
  // היומן נבנה מחדש רק כשהוא משתנה (חוסך עבודה בטלפון)
  const lk = (S.safety || []).length + ':' + ((S.safety || [])[0] || {}).t + ':' + (S.clips || []).length + ':' + new Date().getHours();
  if (lk !== guardLogKey) {
    guardLogKey = lk;
    $('gLogN').textContent = (S.safety || []).length;
    $('gLog').innerHTML = (S.safety || []).slice(0, 60).map((e) => { const q = e.id && byId(e.id); return `<div class="log-item"><span>${EV_ICON[e.ev] || '•'}</span>${e.snap ? `<img class="lsnap" loading="lazy" src="${e.snap}" title="${esc((q ? q.name + ' · ' : '') + e.text)}">` : ''}${e.clip && S.clips && S.clips.includes(e.clip + ':a') ? `<button class="lclip" data-clip="${e.clip}">🎬</button>` : ''}<span><b>${q ? esc(q.name) : ''}</b> ${esc(e.text)}</span><span class="t">${dayLabel(e.t) === 'היום' ? '' : dayLabel(e.t) + ' '}${hhmm(e.t)}</span></div>`; }).join('') || '<div class="hint2" style="margin:4px">אין אירועים עדיין</div>';
  }
}
let guardTouch = 0, guardLogKey = '';
document.addEventListener('pointerdown', (e) => { if (e.target.closest('#p-guard')) guardTouch = Date.now(); });
document.addEventListener('click', (e) => {
  const tb = e.target.closest('.gtools button');
  if (tb) {
    const t = tb.dataset.t;
    if (t === 'test') selfTest();
    if (t === 'arm') { S.settings.armed = !S.settings.armed; save(); logSafety(null, S.settings.armed ? 'start' : 'stop', S.settings.armed ? 'מצב בית ריק הופעל' : 'מצב בית ריק כובה'); syncSend({ type: S.settings.armed ? 'arm' : 'disarm', name: 'ידני' }); toast(null, S.settings.armed ? '🔒 מצב בית ריק פעיל' : '🔓 מצב בית ריק כבוי', S.settings.armed ? 'כל אדם שיזוהה יקפיץ התראה. בן בית מוכר יכבה את המצב אוטומטית' : ''); syncSettings(); guardLogKey = ''; }
    if (t === 'arr') openArrival(null);
    if (t === 'zones') { if (!running) toast(null, 'המצלמה כבויה', 'הפעל מצלמה כדי לסמן דלתות ואזורים'); else { zoneEdit(true); $('stage').scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    if (t === 'cams') { $('setBtn').click(); setTimeout(() => setOpenSec('camSec'), 120); }
    if (t === 'sum') { $('sumBody').innerHTML = dailySummary().map((l) => `<p>${esc(l)}</p>`).join(''); $('sumModal').classList.add('open'); }
    if (t === 'lull' || t === 'noise') { if (SOOTHE.node && SOOTHE.kind === (t === 'lull' ? 'lullaby' : 'noise')) sootheStop(); else sootheStart(t === 'lull' ? 'lullaby' : 'noise', S.settings.snd.sootheMin || 15); }
    guardTouch = 0; return;
  }
  const mk = e.target.closest('.medok'); if (mk && (mk.dataset.vok || mk.dataset.valarm)) { const p = byId(mk.dataset.vok || mk.dataset.valarm); if (p) { if (mk.dataset.vok) verifyOk(p, 'אושר במכשיר'); else verifyAlarm(p, 'המשתמש'); } guardTouch = 0; return; }
  if (mk) { if (mk.dataset.key) medConfirm(mk.dataset.key, 'אושר בלחיצה'); if (mk.dataset.sooth) sootheStop(); guardTouch = 0; return; }
  const lc = e.target.closest('.lclip'); if (lc) { openClip(lc.dataset.clip); return; }
});
document.addEventListener('click', (e) => {
  if (e.target.id === 'gMaster') { S.settings.guardOn = !S.settings.guardOn; save(); if (!S.settings.guardOn) guarded().forEach((p) => { const s = G[p.id]; if (s && (s.state === 'emergency' || s.state === 'asking')) endEmergency(p, 'השמירה כובתה'); }); renderGuard(); syncSettings(); return; }
  const b = e.target.closest('.gbtns button'); if (!b) return;
  const p = byId(b.closest('.gcard').dataset.id); if (!p) return; const s = gs(p.id);
  if (b.dataset.a === 'ok') { if (s.state === 'verify') verifyOk(p, 'אושר במכשיר'); else if (s.state === 'asking' || s.state === 'emergency') resolve(p, 'button'); else { s.lastMotion = Date.now(); s.ref = null; renderGuard(); } }
  if (b.dataset.a === 'pause') { const paused = p.guard.pausedUntil > Date.now(); p.guard.pausedUntil = paused ? 0 : Date.now() + 3600e3; if (!paused && (s.state === 'asking' || s.state === 'emergency')) endEmergency(p, 'הושהה לשעה'); logSafety(p, paused ? 'start' : 'pause', paused ? 'השמירה חודשה' : 'הושהה לשעה'); renderGuard(); }
  if (b.dataset.a === 'drill') { if (!running) { toast(null, 'המצלמה כבויה', 'הפעל מצלמה כדי לתרגל'); return; } if (!S.settings.guardOn) { toast(null, 'השמירה כבויה', 'הפעל את מתג השמירה כדי לתרגל'); return; } trigger(p, 'drill', 'תרגול ידני'); }
  if (b.dataset.a === 'cfg') { openName(p.id); setTimeout(() => document.querySelector('.guardsec').scrollIntoView({ behavior: 'smooth' }), 120); }
});
$('emOk').onclick = () => { const p = byId($('emOverlay').dataset.pid); if (p) resolve(p, 'button'); };
$('emCancel').onclick = () => { const pid = $('emOverlay').dataset.pid; const s = G[pid]; if (s) { $('emOverlay').dataset.hiddenFor = pid + ':' + s.emAt; renderEmergency(); } }; // רק מסתיר — החירום ממשיך
$('emBack').onclick = () => { $('emOverlay').dataset.hiddenFor = ''; renderEmergency(); };
function openLB(src, cap) { if (!src) return; $('lbImg').src = src; $('lbCap').textContent = cap || ''; $('lightbox').classList.add('open'); }
$('lightbox').onclick = () => $('lightbox').classList.remove('open');
$('emSnaps').onclick = (e) => { const f = e.target.closest('figure'); if (f) { const im = f.querySelector('img'); openLB(im && im.src, f.querySelector('figcaption') && f.querySelector('figcaption').textContent); } };
document.addEventListener('click', (e) => { const im = e.target.closest('.lsnap'); if (im) openLB(im.src, im.title); });
$('emMute').onclick = () => { sirenMuted = !sirenMuted; sirenLevel(); renderEmergency(); };
setInterval(() => { renderGuard(); renderEmergency(); renderSoundStatus(); }, 1000);

/* ---------- רקע, מסך דלוק, מסך מלא ---------- */
const ticker = (() => { try { return new Worker(URL.createObjectURL(new Blob(['setInterval(()=>postMessage(0),250)'], { type: 'text/javascript' }))); } catch (e) { return null; } })();
let waitTick = false;
if (ticker) ticker.onmessage = () => { if (waitTick) { waitTick = false; detectLoop(loopGen); } };
function scheduleDetect() { const g = loopGen; if (document.hidden && ticker) waitTick = true; else requestAnimationFrame(() => detectLoop(g)); }
let wakeLock = null, hiddenAt = 0;
async function syncWake() {
  try {
    if (S.settings.wakeLock && running && !document.hidden && navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); }
    if ((!S.settings.wakeLock || !running) && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) hiddenAt = Date.now();
  else { syncWake(); if (guardActive() && hiddenAt && Date.now() - hiddenAt > 5000) toast(null, 'חזרת לחלון', 'בזמן שהחלון היה ברקע המעקב היה איטי יותר'); hiddenAt = 0; }
});

