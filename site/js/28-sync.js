/* =========================================================
   כמה מצלמות בסנכרון — כל המכשירים עם אותו "קוד בית" (ערוץ ntfy)
   ========================================================= */
const HOUSE = { cams: {}, seen: {}, em: {}, es: null, topic: '', warned: {} };
const syncName = () => (S.settings.ntfyTopic ? S.settings.ntfyTopic + '-sync' : '');
function syncOn() { return S.settings.ntfyOn && S.settings.syncOn && syncName(); }
function syncSend(obj) {
  if (!syncOn()) return;
  try { fetch(`${ntfyBase()}/${encodeURIComponent(syncName())}`, { method: 'POST', body: JSON.stringify(Object.assign({ v: 1, dev: S.settings.devId, cam: S.settings.camName, t: Date.now() }, obj)) }).catch(() => {}); } catch (e) {}
}
function syncHouse() {
  const want = syncOn() && running;
  if (want && HOUSE.topic !== syncName()) {
    try { HOUSE.es && HOUSE.es.close(); } catch (e) {}
    HOUSE.topic = syncName();
    try {
      HOUSE.es = new EventSource(`${ntfyBase()}/${encodeURIComponent(HOUSE.topic)}/sse`);
      HOUSE.es.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d.event !== 'message' || !d.message) return; const m = JSON.parse(d.message); if (m.dev === S.settings.devId) return; onSync(m, d.attachment); } catch (er) {} };
    } catch (e) { HOUSE.es = null; }
    syncSend({ type: 'hb', running, guard: S.settings.guardOn, armed: !!S.settings.armed, names: guarded().map((p) => p.name) });
  } else if (!want && HOUSE.es) { try { HOUSE.es.close(); } catch (e) {} HOUSE.es = null; HOUSE.topic = ''; }
}
function onSync(m, att) {
  const now = Date.now();
  HOUSE.cams[m.dev] = Object.assign(HOUSE.cams[m.dev] || {}, { cam: m.cam, t: now });
  if (m.type === 'hb') Object.assign(HOUSE.cams[m.dev], { running: m.running, guard: m.guard, armed: m.armed });
  if ((m.type === 'seen' || m.type === 'zone') && m.name) {
    HOUSE.seen[m.name] = { cam: m.cam, t: now, zone: m.zone };
    const p = S.people.find((x) => x.name === m.name);
    if (p) { if (G[p.id]) G[p.id].remoteSeen = now; arrivalSeen(p.id, m.zone || null, m.cam); }
  }
  if (m.type === 'zone' && !m.name) arrivalSeen(null, m.zone, m.cam);
  if (m.type === 'emergency') {
    HOUSE.em[m.dev + ':' + m.name] = { cam: m.cam, name: m.name, reason: m.reason, t: now };
    toast(null, `🚨 חירום במצלמת ${m.cam}`, `${m.name} · ${REASON_NAMES[m.reason] || m.reason}`); chime('unk');
    speak(`שימו לב, חירום במצלמת ${m.cam}: ${m.name}`, false);
    if (S.settings.syncSiren) sirenStart();
  }
  if (m.type === 'resolved') { delete HOUSE.em[m.dev + ':' + m.name]; if (!Object.keys(HOUSE.em).length && !Object.keys(G).some((k) => G[k].state === 'emergency')) sirenStop(); }
  if (m.type === 'intruder') { toast(null, `🚨 זוהה אדם במצלמת ${m.cam}`, 'מצב בית ריק'); chime('unk'); if (S.settings.syncSiren) { sirenStart(); setTimeout(() => { if (!Object.keys(G).some((k) => G[k].state === 'emergency')) sirenStop(); }, 30000); } }
  if (m.type === 'disarm' && S.settings.armed) { S.settings.armed = false; save(); syncSettings(); toast(null, '🔓 מצב בית ריק כובה', `${m.name} זוהה במצלמת ${m.cam}`); }
  if (m.type === 'arm' && !S.settings.armed) { S.settings.armed = true; save(); syncSettings(); toast(null, '🔒 מצב בית ריק הופעל', `ממצלמת ${m.cam}`); }
  if (m.type === 'arrived') { const x = S.expect.find((y) => y.id === m.id) || S.expect.find((y) => expWho(y) === m.name); if (x) { const st = S.sched[expKey(x)] || (S.sched[expKey(x)] = {}); if (st.st !== 'arrived') { st.st = 'arrived'; st.at = now; st.via = m.zone; st.cam = m.cam; save(); } } }
  if (m.type === 'profiles' && att && att.url) confirmBox(`התקבלו פרופילים ממצלמת "${m.cam}" (${m.count || ''} אנשים). לייבא למכשיר הזה?`, () => importProfiles(att.url));
  renderGuard();
}
setInterval(() => {
  if (!syncOn() || !running) return;
  syncSend({ type: 'hb', running, guard: S.settings.guardOn, armed: !!S.settings.armed, names: guarded().map((p) => p.name) });
  // אנשים שנמצאים כאן — מעדכנים את שאר המצלמות
  const here = new Set(tracks.filter((t) => t.pid && Date.now() - t.seen < 3000).map((t) => t.pid));
  here.forEach((pid) => { const p = byId(pid); if (p && p.name) syncSend({ type: 'seen', name: p.name }); });
  // מצלמה שהפסיקה לשדר
  for (const dev in HOUSE.cams) { const c = HOUSE.cams[dev]; if (Date.now() - c.t > 5 * 60000 && !HOUSE.warned[dev]) { HOUSE.warned[dev] = 1; logSafety(null, 'device', `מצלמת ${c.cam} לא מגיבה`); notifyEvent(null, 'notify', `מצלמת "${c.cam}" לא מגיבה כבר 5 דקות — אולי כבתה או התנתקה`); } else if (Date.now() - c.t < 5 * 60000) HOUSE.warned[dev] = 0; }
}, 60000);
function camsCard() {
  if (!syncOn()) return '';
  const now = Date.now(), cams = Object.values(HOUSE.cams);
  const em = Object.values(HOUSE.em);
  return `<div class="gsec"><div class="grp"><span>📷 מצלמות בבית</span><span>${cams.length + 1}</span></div>
    <div class="crow"><span class="cdot on"></span><b>${esc(S.settings.camName || 'המכשיר הזה')}</b><span class="hint2" style="margin:0">המכשיר הזה · ${running ? 'פועלת' : 'כבויה'}</span></div>
    ${cams.map((c) => `<div class="crow"><span class="cdot ${now - c.t < 3 * 60000 ? 'on' : 'off'}"></span><b>${esc(c.cam)}</b><span class="hint2" style="margin:0">${now - c.t < 3 * 60000 ? (c.running ? 'פועלת' : 'מחוברת, מצלמה כבויה') : 'לא מגיבה · ' + ago(c.t)}</span></div>`).join('')}
    ${em.map((x) => `<div class="crow bad">🚨 <b>${esc(x.name)}</b> · ${esc(REASON_NAMES[x.reason] || x.reason)} · מצלמת ${esc(x.cam)}</div>`).join('')}
    ${Object.keys(HOUSE.seen).length ? `<div class="hint2" style="margin:6px 2px 0">${Object.entries(HOUSE.seen).map(([n, v]) => `${esc(n)}: ${esc(v.cam)} ${ago(v.t)}`).join(' · ')}</div>` : ''}</div>`;
}
async function shareProfiles() {
  if (!syncOn()) { toast(null, 'הסנכרון כבוי', 'הפעל ntfy וסנכרון מצלמות בהגדרות'); return; }
  const people = S.people.filter((p) => p.name).map((p) => Object.assign({}, p, { samples: p.samples.slice(-12).map((x) => ({ e: x.e.map((v) => Math.round(v * 1e4) / 1e4), img: '', t: x.t })) }));
  const blob = new Blob([JSON.stringify({ v: 1, people, pets: S.pets, expect: S.expect })], { type: 'application/json' });
  const q = new URLSearchParams({ filename: 'profiles.json', message: JSON.stringify({ v: 1, dev: S.settings.devId, cam: S.settings.camName, type: 'profiles', count: people.length }) });
  try { await fetch(`${ntfyBase()}/${encodeURIComponent(syncName())}?${q}`, { method: 'PUT', body: blob }); toast(null, 'הפרופילים נשלחו', `${people.length} אנשים · אשרו את הייבוא בשאר המצלמות`); }
  catch (e) { toast(null, 'השליחה נכשלה', 'בדוק חיבור לאינטרנט'); }
}
async function importProfiles(url) {
  try {
    const d = await (await fetch(url)).json(); let added = 0, upd = 0;
    for (const q of d.people || []) {
      const ex = S.people.find((p) => p.name === q.name);
      if (ex) { ex.samples = pickDiverse(ex.samples.concat(q.samples), CFG.maxSamples); ['role', 'gender', 'birthYear', 'ageGroup', 'conds', 'emInstr', 'emContact', 'guard', 'sched', 'greeting'].forEach((k) => { if (q[k] != null) ex[k] = q[k]; }); upd++; }
      else { S.people.push(Object.assign({}, q, { id: uid(), visits: 0, lastSeen: 0, firstSeen: Date.now() })); added++; }
    }
    if (Array.isArray(d.pets)) d.pets.forEach((pt) => { if (!S.pets.some((x) => x.name === pt.name)) S.pets.push(pt); });
    normalizeState(); save(); render(); renderGuard(); toast(null, 'הפרופילים יובאו', `${added} חדשים · ${upd} עודכנו`);
  } catch (e) { toast(null, 'הייבוא נכשל', 'ייתכן שהקובץ פג תוקף — שלחו שוב'); }
}

