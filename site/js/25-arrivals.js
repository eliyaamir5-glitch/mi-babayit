/* =========================================================
   הגעות צפויות: "דני אמור לחזור ב־11:00 דרך הדלת"
   ========================================================= */
S.expect = S.expect || [];
const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
function expActiveToday(x) { const d = new Date(); if (x.once) return x.once === todayKey(); return !x.days || !x.days.length || x.days.includes(d.getDay()); }
const expWho = (x) => (x.who === 'any' ? x.label || 'מישהו' : (byId(x.who) && byId(x.who).name) || x.label || '?');
const expKey = (x) => `arr:${todayKey()}:${x.id}`;
function expWindow(x) { const t = hm(x.time), w = x.win || 30; return [t - w, t + w]; }
function arrTick() {
  const nm = nowMin(), now = Date.now();
  for (const x of S.expect) {
    if (!x.on || !expActiveToday(x)) continue;
    const [a, b] = expWindow(x), key = expKey(x), st = S.sched[key];
    if (!st && nm >= a && nm <= b) { S.sched[key] = { st: 'waiting', t: now }; save(); renderGuard(); }
    if (st && st.st === 'waiting' && nm > b) {
      st.st = 'late'; st.lt = now; save();
      const m = `${expWho(x)} היה אמור להגיע ב־${x.time}${x.zones && x.zones.length ? ' דרך ' + zonesText(x) : ''} ועדיין לא זוהה`;
      logSafety(x.who !== 'any' ? byId(x.who) : null, 'notify', m, snapDataURL(360));
      alertArrival(x, '⚠️ עדיין לא הגיע', m, true); renderGuard();
    }
  }
}
const zonesText = (x) => (x.zones || []).map((id) => (S.zones.find((z) => z.id === id) || {}).name).filter(Boolean).join(' או ') || x.zoneNames || '';
// נקרא כשאדם זוהה (בכל מקום, או ליד אזור כניסה), גם ממצלמה אחרת
function arrivalSeen(pid, zoneName, cam) {
  const nm = nowMin(), now = Date.now(), p = pid && byId(pid);
  for (const x of S.expect) {
    if (!x.on || !expActiveToday(x)) continue;
    const [a, b] = expWindow(x); if (nm < a - 30 || nm > b + 240) continue; // חצי שעה לפני ועד 4 שעות אחרי
    const match = x.who === 'any' ? true : (pid && x.who === pid) || (p && byId(x.who) && byId(x.who).name === p.name);
    if (!match) continue;
    const zn = (x.zones || []).map((id) => (S.zones.find((z) => z.id === id) || {}).name).filter(Boolean);
    if (zn.length && !(zoneName && zn.includes(zoneName))) continue; // נדרש דרך אזור מסוים
    if (x.who === 'any' && !zoneName && !zn.length && pid) continue; // "כל אחד" בלי אזור — רק אדם לא מוכר או ליד כניסה
    const key = expKey(x), st = S.sched[key] || (S.sched[key] = { st: 'waiting', t: now });
    if (st.st === 'arrived') continue;
    const wasLate = st.st === 'late'; st.st = 'arrived'; st.at = now; st.via = zoneName || ''; st.cam = cam || S.settings.camName || ''; save();
    const who = x.who === 'any' ? (p && p.name ? p.name : x.label || 'מישהו') : expWho(x);
    const m = `${who} ${wasLate ? 'הגיע באיחור' : 'הגיע'} ב־${hhmm(now)}${zoneName ? ' דרך ' + zoneName : ''}${cam ? ' (מצלמת ' + cam + ')' : ''}${x.time ? ' · היה צפוי ב־' + x.time : ''}`;
    logSafety(p || null, 'resolved', m, cam ? null : snapDataURL(360));
    alertArrival(x, wasLate ? '✅ הגיע באיחור' : '✅ הגיע', m, false);
    if (!cam) syncSend({ type: 'arrived', id: x.id, name: who, zone: zoneName || '' });
    renderGuard();
  }
}
function alertArrival(x, title, msg, urgent) {
  toast(x.who !== 'any' ? byId(x.who) : null, `${title}: ${expWho(x)}`, msg); chime(urgent ? 'unk' : 'known'); A.chimeUntil = Date.now() + 1500;
  sendAlerts(x.who !== 'any' ? byId(x.who) : null, 'notify', `${title}${x.resp ? ' (לידיעת ' + x.resp + ')' : ''}\n${msg}`);
  if (x.topic && S.settings.ntfyOn !== undefined) sendExtra(x.topic, `${title} — ${expWho(x)}`, msg, !urgent ? null : undefined);
}
async function sendExtra(topic, title, msg) {
  try {
    const img = await snapshotBlob().catch(() => null), q = new URLSearchParams({ title, priority: '4', tags: 'door' });
    if (img) { q.set('message', msg); q.set('filename', 'camera.jpg'); }
    await fetch(`${ntfyBase()}/${encodeURIComponent(topic.replace(/[^\w-]/g, ''))}?${q}`, { method: img ? 'PUT' : 'POST', body: img || msg });
  } catch (e) {}
}
// עורך הגעה צפויה
let expDraft = null;
function openArrival(x, presetWho) {
  expDraft = x ? JSON.parse(JSON.stringify(x)) : { id: 'e' + Date.now().toString(36), who: presetWho || 'any', label: '', time: '', win: 30, days: [0, 1, 2, 3, 4], once: '', zones: S.zones.filter(isEntryZone).slice(0, 1).map((z) => z.id), resp: '', topic: '', on: true, isNew: true };
  if (!expDraft.time) { const d = new Date(Date.now() + 3600e3); expDraft.time = `${String(d.getHours()).padStart(2, '0')}:00`; }
  $('eWho').innerHTML = `<option value="any">מישהו (אורח, טכנאי, שליח...)</option>` + S.people.filter((p) => p.name).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  $('eWho').value = expDraft.who; $('eLabel').value = expDraft.label || ''; $('eTime').value = expDraft.time; $('eWin').value = String(expDraft.win || 30);
  $('eResp').value = expDraft.resp || ''; $('eTopic').value = expDraft.topic || ''; $('eDel').classList.toggle('hidden', !!expDraft.isNew);
  renderExpForm(); $('arrModal').classList.add('open');
}
function renderExpForm() {
  $('eLabelW').classList.toggle('hidden', $('eWho').value !== 'any');
  $('eDays').innerHTML = DAYS.map((d, i) => `<button data-d="${i}" class="${!expDraft.once && expDraft.days.includes(i) ? 'on' : ''}" aria-pressed="${!expDraft.once && expDraft.days.includes(i)}">${d}</button>`).join('') + `<button data-d="once" class="${expDraft.once ? 'on' : ''}">רק היום</button>`;
  const ez = S.zones;
  $('eZones').innerHTML = ez.length ? ez.map((z) => `<button data-z="${z.id}" class="${expDraft.zones.includes(z.id) ? 'on' : ''}">${ZONE_TYPES[z.type].icon} ${esc(z.name)}</button>`).join('') : '<span class="hint2" style="margin:0">עוד לא סימנת דלתות או חלונות. אפשר לסמן ב"📍 דלתות ואזורים" מתחת למצלמה. בלי אזור — כל זיהוי נחשב הגעה.</span>';
}
$('eWho').onchange = renderExpForm;
$('eDays').onclick = (e) => { const b = e.target.closest('[data-d]'); if (!b) return; if (b.dataset.d === 'once') { expDraft.once = expDraft.once ? '' : todayKey(); } else { expDraft.once = ''; const i = +b.dataset.d; expDraft.days = expDraft.days.includes(i) ? expDraft.days.filter((d) => d !== i) : [...expDraft.days, i]; } renderExpForm(); };
$('eZones').onclick = (e) => { const b = e.target.closest('[data-z]'); if (!b) return; const id = b.dataset.z; expDraft.zones = expDraft.zones.includes(id) ? expDraft.zones.filter((z) => z !== id) : [...expDraft.zones, id]; renderExpForm(); };
$('eSave').onclick = () => {
  expDraft.who = $('eWho').value; expDraft.label = $('eLabel').value.trim(); expDraft.time = $('eTime').value || '12:00'; expDraft.win = +$('eWin').value || 30;
  expDraft.resp = $('eResp').value.trim(); expDraft.topic = $('eTopic').value.trim(); const isNew = expDraft.isNew; delete expDraft.isNew;
  if (expDraft.who === 'any' && !expDraft.label) expDraft.label = 'אורח';
  S.expect = S.expect.filter((x) => x.id !== expDraft.id); S.expect.push(expDraft);
  delete S.sched[expKey(expDraft)]; save(); $('arrModal').classList.remove('open'); renderGuard(); if (editingId) renderArrivalsInProfile();
  toast(null, isNew ? '🚪 נוספה הגעה צפויה' : 'ההגעה עודכנה', `${expWho(expDraft)} · ${expDraft.time}${expDraft.zones.length ? ' · ' + zonesText(expDraft) : ''}`);
};
$('eDel').onclick = () => { const id = expDraft.id; $('arrModal').classList.remove('open'); confirmBox('למחוק את ההגעה הצפויה?', () => { S.expect = S.expect.filter((x) => x.id !== id); save(); renderGuard(); if (editingId) renderArrivalsInProfile(); }); };
$('eCancel').onclick = () => $('arrModal').classList.remove('open');
function expStatus(x) {
  if (!expActiveToday(x)) return { cls: 'off', txt: 'לא היום' };
  const st = S.sched[expKey(x)], [a, b] = expWindow(x), nm = nowMin();
  if (st && st.st === 'arrived') return { cls: 'ok', txt: `הגיע ${hhmm(st.at)}${st.via ? ' · ' + st.via : ''}` };
  if (st && st.st === 'late') return { cls: 'bad', txt: 'עדיין לא הגיע' };
  if (st && st.st === 'waiting') return { cls: 'warn', txt: 'מחכה עכשיו' };
  return nm < a ? { cls: 'idle', txt: `בעוד ${fmtSec((a - nm) * 60)}` } : { cls: 'idle', txt: 'הסתיים' };
}
function arrivalsCard() {
  const list = S.expect.slice().sort((a, b) => hm(a.time) - hm(b.time));
  return `<div class="gsec"><div class="grp"><span>🚪 הגעות צפויות</span><button class="minibtn" data-arr="new">+ הוסף</button></div>
    ${list.length ? list.map((x) => { const s = expStatus(x); return `<div class="arow" data-arr="${x.id}" tabindex="0" role="button"><b>${x.time}</b><span class="aw">${esc(expWho(x))}${x.zones && x.zones.length ? ' · ' + esc(zonesText(x)) : ''}</span><span class="achip ${s.cls}">${s.txt}</span></div>`; }).join('')
    : '<div class="hint2" style="margin:4px">למשל: "דני אמור לחזור מבית הספר ב־13:00 דרך הדלת". אם לא יגיע בזמן — תקבל התראה.</div>'}</div>`;
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-arr]'); if (!a) return;
  if (a.dataset.arr === 'new') openArrival(null); else { const x = S.expect.find((y) => y.id === a.dataset.arr); if (x) openArrival(x); }
});
function renderArrivalsInProfile() {
  const p = byId(editingId); if (!p) return;
  const mine = S.expect.filter((x) => x.who === p.id);
  $('mArrivals').innerHTML = mine.map((x) => `<div class="schedrow" data-arr="${x.id}" role="button" tabindex="0"><span class="si">🚪</span><span class="sn">הגעה צפויה</span><b>${x.time}</b><span class="hint2" style="margin:0">${x.zones && x.zones.length ? esc(zonesText(x)) : 'בכל מקום'} · ${x.once ? 'רק היום' : (x.days || []).map((d) => DAYS[d]).join(' ')}</span></div>`).join('');
}

