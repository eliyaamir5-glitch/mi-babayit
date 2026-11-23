/* ---- profile ---- */
const ROLE_GROUPS = [
  { id: 'home', name: 'בני הבית', roles: ['אבא', 'אמא', 'בעל', 'אישה', 'בן', 'בת', 'אח', 'אחות', 'בן בית'] },
  { id: 'family', name: 'משפחה', roles: ['סבא', 'סבתא', 'דוד', 'דודה', 'בן דוד', 'בת דודה', 'גיס', 'גיסה', 'חם', 'חמות', 'נכד', 'נכדה', 'קרוב משפחה'] },
  { id: 'friends', name: 'חברים ושכנים', roles: ['חבר', 'חברה', 'שכן', 'שכנה'] },
  { id: 'other', name: 'אחר', roles: ['אורח', 'עובד', 'מטפלת', 'שליח', 'אחר'] },
];
const groupOf = (role) => (ROLE_GROUPS.find((g) => g.roles.includes(role)) || {}).id || null;
let draft = null;
function openName(id) {
  const p = byId(id); if (!p) return;
  editingId = id;
  draft = { role: p.role || null, alert: p.alert !== false, gender: p.gender || 'm', guardOn: !!(p.guard && p.guard.on),
    conds: Object.assign({}, p.conds || {}), ov: JSON.parse(JSON.stringify((p.guard && p.guard.ov) || {})) };
  $('mBirth').value = p.birthYear || ''; $('mAge').value = p.ageGroup || '';
  $('mAllergy').value = p.allergyNote || ''; $('mCondOther').value = p.condOther || '';
  $('mEmInstr').value = p.emInstr || ''; $('mEmName').value = (p.emContact && p.emContact.name) || ''; $('mEmPhone').value = (p.emContact && p.emContact.phone) || '';
  $('mAskN').value = (p.guard && p.guard.askN) || 3; $('mAskGapW').innerHTML = timeInput('id="mAskGap"', (p.guard && p.guard.askGap) || 15, false, ['s', 'm']);
  draft.sched = JSON.parse(JSON.stringify(p.sched || []));
  renderGuardProfile(); renderSchedEd(); showPTab(p.name ? 'main' : 'main');
  $('mImg').src = p.thumb; $('mTitle').textContent = nameOf(p);
  $('mLive').classList.toggle('hidden', !presentIds().has(id));
  $('mInput').value = p.name || '';
  $('mGreet').value = p.greeting || '';
  $('mNotes').value = p.notes || '';
  renderRoles(); renderStats(p);
  const others = S.people.filter((x) => x.name && x.id !== id);
  $('mMergeWrap').classList.toggle('hidden', !others.length);
  $('mChips').innerHTML = others.map((o) => `<button data-m="${o.id}"><img src="${o.thumb}">${esc(o.name)}</button>`).join('');
  renderSamples(p); renderArrivalsInProfile();
  $('nameModal').classList.add('open');
  $('nameModal').querySelector('.pbody').scrollTop = 0;
  if (!p.name) setTimeout(() => $('mInput').focus(), 60);
}
function showPTab(t) {
  draft && (draft.ptab = t);
  document.querySelectorAll('#pTabs button').forEach((b) => { b.classList.toggle('on', b.dataset.pt === t); b.setAttribute('aria-selected', b.dataset.pt === t); });
  document.querySelectorAll('.pbody [data-pt]').forEach((el) => el.classList.toggle('pt-hide', el.dataset.pt !== t));
  const pb = document.querySelector('#nameModal .pbody'); if (pb) pb.scrollTop = 0;
}
$('pTabs').onclick = (e) => { const b = e.target.closest('[data-pt]'); if (b) showPTab(b.dataset.pt); };
$('mGoSafe').onclick = () => showPTab('safe');
$('mGuard2').onclick = () => { draft.guardOn = !draft.guardOn; renderGuardProfile(); if (draft.guardOn) showPTab('safe'); };
function renderSchedEd() {
  $('mSched').innerHTML = draft.sched.length ? draft.sched.map((it, i) => `<div class="schedrow" data-i="${i}"><span class="si">${SCHED_TYPES[it.type].icon}</span><span class="sn">${SCHED_TYPES[it.type].name}</span>
    <input class="field sm" type="time" value="${it.time || ''}" data-f="time">
    ${it.type === 'med' ? `<input class="field sm" type="text" value="${esc(it.text || '')}" placeholder="איזו תרופה? (למשל כדור לחץ דם)" data-f="text">` : ''}
    <button class="switch ${it.on ? 'on' : ''}" data-f="on"></button><button class="sx" data-f="del" title="מחק">✕</button></div>`).join('')
    : '<div class="hint2" style="margin:0">אפשר להוסיף בדיקת שלום יומית, תזכורת לתרופה, או שעה שעד אליה האדם צריך להיראות.</div>';
}
$('mSched').onclick = (e) => { const b = e.target.closest('[data-f]'); if (!b) return; const i = +b.closest('.schedrow').dataset.i; if (b.dataset.f === 'on') { draft.sched[i].on = !draft.sched[i].on; renderSchedEd(); } if (b.dataset.f === 'del') { draft.sched.splice(i, 1); renderSchedEd(); } };
$('mSched').onchange = (e) => { const f = e.target.dataset.f; if (f !== 'time' && f !== 'text') return; const i = +e.target.closest('.schedrow').dataset.i; draft.sched[i][f] = e.target.value; };
document.querySelector('.schedadd').onclick = (e) => { const b = e.target.closest('[data-add]'); if (!b) return; const t = b.dataset.add;
  if (t === 'arrive') { const p = byId(editingId); if (!p || !p.name) { toast(null, 'חסר שם', 'שמור קודם שם לאדם הזה'); return; } openArrival(null, editingId); return; } draft.sched.push({ id: 's' + Date.now().toString(36), type: t, time: t === 'checkin' ? '09:00' : t === 'med' ? '08:00' : '10:00', text: '', on: true, grace: 30 }); renderSchedEd(); };
function draftPerson() {
  return { birthYear: +$('mBirth').value || null, ageGroup: $('mAge').value || null, conds: draft.conds, guard: { ov: draft.ov } };
}
function renderGuardProfile() {
  document.querySelectorAll('#mGender button').forEach((b) => b.classList.toggle('on', b.dataset.g === draft.gender));
  const dp = draftPerson(); const ag = ageGroupOf(dp);
  $('mAgeHint').textContent = dp.ageGroup ? '' : (dp.birthYear ? `לפי שנת הלידה: ${AGE_NAMES[ag]} (גיל ${new Date().getFullYear() - dp.birthYear})` : 'בלי שנת לידה ייחשב מבוגר');
  $('mGuard').classList.toggle('on', draft.guardOn); $('mGuard2').classList.toggle('on', draft.guardOn);
  { const r0 = effRules(dp), on = Object.keys(r0).filter((k) => r0[k].on).map((k) => RULES[k].name); $('mGuardSum').textContent = draft.guardOn ? (on.length ? 'פעילה · ' + on.join(', ') : 'פעילה · אין כללים') : 'כבויה — הפעל כדי שהמצלמה תשמור על האדם הזה'; }
  $('mGuardBody').classList.toggle('hidden', !draft.guardOn);
  $('mConds').classList.add('dz');
  $('mConds').innerHTML = CONDS.map((c) => `<button data-c="${c.id}" class="${draft.conds[c.id] ? 'on' : ''}">${c.name}</button>`).join('');
  $('mAllergy').classList.toggle('hidden', !draft.conds.allergy);
  $('mCondOther').classList.toggle('hidden', !draft.conds.other);
  const r = effRules(dp);
  $('mRules').innerHTML = Object.keys(RULES).map((k) => {
    const R = RULES[k], e = r[k];
    return `<div class="rule" data-k="${k}"><button class="switch ${e.on ? 'on' : ''}" data-act="tog"></button>
      <div class="rn">${R.name}<small>${R.desc}</small></div>
      ${R.timed ? timeInput('data-act="val"', e.val, !e.on) : ''}
      <span class="tagauto ${e.manual ? 'man' : ''}" data-act="reset" title="${e.manual ? 'לחץ לחזרה להגדרה האוטומטית' : ''}">${e.manual ? 'ידני ↺' : 'אוטומטי'}</span></div>`;
  }).join('');
}
$('mGender').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; draft.gender = b.dataset.g; renderGuardProfile(); };
$('mBirth').oninput = renderGuardProfile; $('mAge').onchange = renderGuardProfile;
$('mGuard').onclick = () => { draft.guardOn = !draft.guardOn; renderGuardProfile(); };
$('mConds').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; draft.conds[b.dataset.c] = !draft.conds[b.dataset.c]; if (!draft.conds[b.dataset.c]) delete draft.conds[b.dataset.c]; renderGuardProfile(); };
$('mRules').onclick = (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return; const k = el.closest('.rule').dataset.k;
  if (el.dataset.act === 'tog') { const cur = effRules(draftPerson())[k]; draft.ov[k] = Object.assign({}, draft.ov[k], { on: !cur.on }); renderGuardProfile(); }
  if (el.dataset.act === 'reset' && draft.ov[k]) { delete draft.ov[k]; renderGuardProfile(); }
};
$('mRules').onchange = (e) => {
  const w = e.target.closest('.tin'); if (!w) return; const k = e.target.closest('.rule').dataset.k, R = RULES[k];
  const v = Math.max(R.min, Math.min(R.max, Math.round(readTime(w)) || R.val));
  draft.ov[k] = Object.assign({}, draft.ov[k], { val: v }); renderGuardProfile();
};
function renderRoles() {
  $('mRoles').innerHTML = !draft.rolesOpen
    ? `<div class="roles">${draft.role ? `<button class="on" data-ropen="1">${esc(draft.role)}</button>` : ''}<button data-ropen="1" aria-expanded="false">${draft.role ? 'שינוי' : 'בחירה'} ▾</button></div>`
    : ROLE_GROUPS.map((g) => `<div class="rgroup"><small>${g.name}</small><div class="roles">${g.roles.map((r) => `<button data-r="${r}" class="${draft.role === r ? 'on' : ''}">${r}</button>`).join('')}</div></div>`).join('');
  $('mRoleBadge').innerHTML = draft.role ? `<b>${esc(draft.role)}</b>` : 'עוד לא נבחר קשר';
  $('mAlert').classList.toggle('on', draft.alert);
}
$('mRoles').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.ropen) { draft.rolesOpen = true; renderRoles(); return; } draft.role = draft.role === b.dataset.r ? null : b.dataset.r; draft.rolesOpen = false; renderRoles(); };
$('mAlert').onclick = () => { draft.alert = !draft.alert; renderRoles(); };
$('mInput').oninput = () => { $('mTitle').textContent = $('mInput').value.trim() || nameOf(byId(editingId)); };
$('mGreetTest').onclick = () => { const n = $('mInput').value.trim() || 'אורח'; const g = $('mGreet').value.trim() || `שלום ${n}`; const v = S.settings.voice; S.settings.voice = true; say(g); S.settings.voice = v; };
function renderStats(p) {
  const visits = S.log.filter((l) => l.id === p.id);
  $('psVisits').textContent = p.visits;
  $('psFirst').textContent = ago(p.firstSeen);
  $('psLast').textContent = presentIds().has(p.id) ? 'עכשיו' : ago(p.lastSeen);
  const hrs = new Array(24).fill(0); visits.forEach((v) => hrs[new Date(v.t).getHours()]++);
  const maxH = Math.max(...hrs);
  $('psHour').textContent = maxH ? `${String(hrs.indexOf(maxH)).padStart(2, '0')}:00` : '-';
  $('mHours').innerHTML = hrs.map((n, h) => `<i style="--a:${maxH ? 0.08 + 0.92 * n / maxH : 0.06}" title="${h}:00 · ${n} כניסות"></i>`).join('');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
    const n = visits.filter((v) => v.t >= d.getTime() && v.t < d.getTime() + 864e5).length;
    days.push({ n, label: i === 0 ? 'היום' : d.toLocaleDateString('he-IL', { weekday: 'short' }) });
  }
  const maxD = Math.max(1, ...days.map((d) => d.n));
  $('mBars').innerHTML = days.map((d) => `<div><em>${d.n || ''}</em><i class="${d.n ? '' : 'z'}" style="height:${d.n ? 12 + 88 * d.n / maxD : 3}%"></i><span>${d.label}</span></div>`).join('');
  $('mVisits').innerHTML = visits.slice(0, 6).map((v) => `<div class="vrow"><b>${dayLabel(v.t)}</b><span>${hhmm(v.t)}</span></div>`).join('') || '<div class="hint2" style="margin:0">אין עדיין כניסות</div>';
}
function renderSamples(p) {
  $('mSampleN').textContent = p.samples.length;
  $('mSamples').innerHTML = p.samples.map((x, i) => `<button data-i="${i}" title="מחק מבט"><img src="${x.img || p.thumb}"></button>`).join('');
}
$('mSamples').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  const p = byId(editingId); if (!p || p.samples.length <= 1) { toast(null, 'אי אפשר', 'חייב להישאר לפחות מבט אחד'); return; }
  p.samples.splice(+b.dataset.i, 1); save(); renderSamples(p);
};
$('wrYes').onclick = () => { $('wrModal').classList.remove('open'); markWrong(); };
$('wrNo').onclick = () => $('wrModal').classList.remove('open');
function closeName() { $('nameModal').classList.remove('open'); editingId = null; draft = null; render(); }
$('nameModal').onclick = (e) => { if (e.target.id === 'nameModal') closeName(); };
function merge(fromId, intoId) {
  const a = byId(fromId), b = byId(intoId); if (!a || !b) return;
  b.samples = pickDiverse(b.samples.concat(a.samples), CFG.maxSamples);
  b.visits += a.visits; b.firstSeen = Math.min(a.firstSeen, b.firstSeen); b.lastSeen = Math.max(a.lastSeen, b.lastSeen);
  ['role', 'greeting', 'notes', 'gender', 'birthYear', 'ageGroup', 'conds', 'allergyNote', 'condOther', 'emInstr', 'emContact', 'guard'].forEach((k) => { if (!b[k] && a[k]) b[k] = a[k]; });
  S.log.forEach((l) => { if (l.id === a.id) l.id = b.id; });
  tracks.forEach((t) => { if (t.pid === a.id) t.pid = b.id; });
  S.people = S.people.filter((x) => x.id !== a.id); dropG(a.id);
}
$('mChips').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; merge(editingId, b.dataset.m); save(); closeName(); toast(null, 'אוחד', 'המבטים נוספו לאדם הקיים'); };
$('mSave').onclick = () => {
  const v = $('mInput').value.trim();
  const p = byId(editingId); if (!p) return;
  if (!v && (draft.role || $('mGreet').value.trim())) { $('mInput').focus(); toast(null, 'חסר שם', 'כתוב שם כדי לשמור את הפרופיל'); return; }
  if (draft.guardOn && !v) { $('mInput').focus(); toast(null, 'חסר שם', 'כדי להפעיל שמירה צריך לתת שם'); return; }
  p.role = draft.role; p.alert = draft.alert; p.gender = draft.gender;
  p.birthYear = +$('mBirth').value || null; p.ageGroup = $('mAge').value || null; p.conds = draft.conds;
  p.allergyNote = $('mAllergy').value.trim(); p.condOther = $('mCondOther').value.trim();
  p.emInstr = $('mEmInstr').value.trim(); p.emContact = { name: $('mEmName').value.trim(), phone: $('mEmPhone').value.trim() };
  const wasGuard = !!(p.guard && p.guard.on);
  p.guard = Object.assign({}, p.guard, { on: draft.guardOn, ov: draft.ov, askN: Math.max(1, Math.min(10, Math.round(+$('mAskN').value) || 3)), askGap: Math.max(3, Math.min(3600, Math.round(readTime($('mAskGapW').querySelector('.tin'))) || 15)), v2: true });
  p.greeting = $('mGreet').value.trim(); p.notes = $('mNotes').value.trim();
  p.sched = draft.sched;
  const same = v && S.people.find((x) => x.id !== editingId && x.name === v);
  const wasNew = !p.name && v;
  if (same) merge(editingId, same.id); else if (v) p.name = v;
  if (!same) guardProfileChanged(p, wasGuard);
  save(); closeName();
  if (v) { toast(same || p, `נשמר: ${v}${p.role ? ' · ' + p.role : ''}`, wasNew ? 'מעכשיו אזהה אותו אוטומטית' : 'הפרופיל עודכן'); chime('known'); }
};
$('mInput').onkeydown = (e) => { if (e.key === 'Enter') $('mSave').click(); };
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && editingId) closeName(); });
$('mCancel').onclick = closeName;
$('mDel').onclick = () => { const id = editingId; const p = byId(id); closeName(); confirmBox(`למחוק את "${nameOf(p)}"?`, () => { S.people = S.people.filter((x) => x.id !== id); tracks.forEach((t) => { if (t.pid === id) t.pid = null; }); dropG(id); save(); render(); }); };

