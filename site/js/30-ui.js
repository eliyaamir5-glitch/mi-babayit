/* ---------------- UI ---------------- */
function presentIds() { const s = new Set(tracks.filter((t) => t.pid && Date.now() - t.seen < 1500).map((t) => t.pid)); lookPresent().forEach((by, pid) => s.add(pid)); return s; }
function faceIds() { return new Set(tracks.filter((t) => t.pid && Date.now() - t.seen < 1500).map((t) => t.pid)); }
const ICON_EMPTY = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
function personRow(p, here) {
  return `<div class="person ${p.name ? '' : 'unk'} ${here ? 'here' : ''}" data-id="${p.id}" tabindex="0" role="button" aria-label="פרופיל של ${esc(nameOf(p))}">
    <div class="avwrap"><img class="avatar" src="${p.thumb || ''}"><span class="live"></span></div>
    <div class="pinfo"><div class="pname">${esc(nameOf(p))}${p.role ? `<span class="rbadge">${esc(p.role)}</span>` : ''}</div>
    <div class="pmeta">${here ? (faceIds().has(p.id) ? 'מול המצלמה עכשיו' : 'בחדר עכשיו · מזוהה לפי מראה') + (personActText(p.id) ? ' · ' + personActText(p.id) : '') : 'נראה ' + ago(p.lastSeen)} · ${p.visits} כניסות</div></div>
    ${p.name ? '' : '<span class="chip">תן שם</span>'}
  </div>`;
}
function render() {
  if (editingId) return;
  const here = presentIds();
  const unk = S.people.filter((p) => !p.name).sort((a, b) => b.lastSeen - a.lastSeen);
  const kn = S.people.filter((p) => p.name).sort((a, b) => b.lastSeen - a.lastSeen);
  const nowP = S.people.filter((p) => here.has(p.id));
  const unidentified = tracks.filter((t) => !t.pid && Date.now() - t.seen < 1500).length;
  const faceless = facelessBodies(Date.now());
  const today = S.log.filter((l) => new Date(l.t).toDateString() === new Date().toDateString()).length;

  $('tN').textContent = nowP.length; $('tU').textContent = unk.length; $('tK').textContent = kn.length;
  $('tU').classList.toggle('hot', unk.length > 0);
  $('stNow').textContent = nowP.length + unidentified + faceless; $('stKnown').textContent = kn.length; $('stUnk').textContent = unk.length; $('stToday').textContent = today;
  const total = nowP.length + unidentified + faceless;
  $('hudCount').textContent = total ? (total === 1 ? 'אדם אחד מול המצלמה' : `${total} אנשים מול המצלמה`) : 'אין אף אחד מול המצלמה';

  $('p-now').innerHTML = nowP.length || unidentified || faceless
    ? nowP.map((p) => personRow(p, true)).join('') + (faceless ? `<div class="empty" style="padding:14px">${faceless === 1 ? 'אדם אחד שהפנים שלו לא נראות' : faceless + ' אנשים שהפנים שלהם לא נראות'}</div>` : '') + (unidentified ? `<div class="empty" style="padding:14px">מזהה ${unidentified === 1 ? 'פנים נוספות' : unidentified + ' פנים נוספות'}...</div>` : '')
    : `<div class="empty">${ICON_EMPTY}<br>${running ? 'אף אחד לא מול המצלמה כרגע' : 'המצלמה כבויה'}</div>`;
  $('p-unk').innerHTML = unk.length ? unk.map((p) => personRow(p, here.has(p.id))).join('') : `<div class="empty">${ICON_EMPTY}<br>אין פנים חדשות.<br>מי שלא מוכר למערכת יופיע כאן.</div>`;
  if (!kn.length) $('p-known').innerHTML = `<div class="empty">${ICON_EMPTY}<br>עוד לא נתת שם לאף אחד.</div>`;
  else {
    const groups = ROLE_GROUPS.map((g) => ({ name: g.name, list: kn.filter((p) => groupOf(p.role) === g.id) }));
    groups.push({ name: 'בלי קשר מוגדר', list: kn.filter((p) => !groupOf(p.role)) });
    $('p-known').innerHTML = groups.filter((g) => g.list.length).map((g) => `<div class="grp"><span>${g.name}</span><span>${g.list.length}</span></div>` + g.list.map((p) => personRow(p, here.has(p.id))).join('')).join('');
  }

  let html = '', lastDay = '';
  for (const l of S.log.slice(0, 120)) {
    const p = byId(l.id); const d = dayLabel(l.t);
    if (d !== lastDay) { html += `<div class="daysep">${d}</div>`; lastDay = d; }
    html += `<div class="log-item">${p ? `<img src="${p.thumb}">` : ''}<span>${p ? esc(nameOf(p)) : 'נמחק'}${p && p.role ? ` <span class="rbadge">${esc(p.role)}</span>` : ''} נכנס</span><span class="t">${hhmm(l.t)}</span></div>`;
  }
  $('p-log').innerHTML = timelineHTML() + (html || `<div class="empty">${ICON_EMPTY}<br>היומן ריק</div>`);
}
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
  document.querySelectorAll('.pane').forEach((x) => x.classList.toggle('active', x.id === 'p-' + t.dataset.tab));
}));
document.querySelector('.side').addEventListener('click', (e) => { const r = e.target.closest('.person'); if (r) openName(r.dataset.id); });

