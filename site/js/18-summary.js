/* =========================================================
   סיכום יומי — טקסט קבוע לפי היומן (בלי "להמציא" אירועים)
   ========================================================= */
function dailySummary(forDay) {
  const start = forDay || dayStart(), end = start + 864e5, dk = localKey(start);
  const people = S.people.filter((p) => p.name && ((p.guard && p.guard.on) || S.log.some((l) => l.id === p.id && l.t >= start && l.t < end)));
  const lines = [];
  for (const p of people) {
    const vis = S.log.filter((l) => l.id === p.id && l.t >= start && l.t < end).sort((a, b) => a.t - b.t);
    const ev = (S.safety || []).filter((e) => e.id === p.id && e.t >= start && e.t < end);
    const em = ev.filter((e) => e.ev === 'emergency').length, det = ev.filter((e) => e.ev === 'detect').length;
    const meds = Object.entries(S.sched).filter(([k]) => k.startsWith(dk + ':' + p.id + ':')).map(([k, v]) => ({ k, v, it: (p.sched || []).find((i) => k.endsWith(':' + i.id)) })).filter((x) => x.it);
    const medsT = meds.filter((x) => x.it.type === 'med'), medOk = medsT.filter((x) => x.v.st === 'ok').length;
    const chk = meds.filter((x) => x.it.type === 'checkin');
    let l = `${p.name}: `;
    if (vis.length || p.lastSeen >= start) l += `נראה ${vis.length ? 'לראשונה ב־' + hhmm(vis[0].t) + ', ' : ''}לאחרונה ב־${hhmm(Math.min(p.lastSeen, end))}${vis.length > 1 ? `, ${vis.length} כניסות` : ''}.`;
    else l += 'לא נראה היום.';
    if (medsT.length) l += ` תרופות: ${medOk} מתוך ${medsT.length} אושרו.`;
    if (chk.length) l += ` בדיקות שלום: ${chk.filter((x) => x.v.st === 'ok').length} מתוך ${chk.length} נענו.`;
    l += em ? ` 🚨 ${em} מצבי חירום.` : det ? ` ${det} בדיקות "הכל טוב?", כולן נענו.` : ' בלי אירועים חריגים.';
    lines.push(l);
  }
  const snd = (S.safety || []).filter((e) => e.ev === 'sound' && e.t >= start && e.t < end).length;
  if (snd) lines.push(`🔊 ${snd} אירועי קול (בכי, צעקה או רעש).`);
  return lines.length ? lines : ['אין עדיין נתונים להיום.'];
}
setInterval(() => {
  if (!S.settings.summaryOn) return;
  const key = 'summary:' + todayKey();
  if (S.sched[key] || nowMin() < hm(S.settings.summaryAt || '21:00')) return;
  S.sched[key] = { st: 'sent', t: Date.now() }; save();
  sendAlerts(null, 'summary', dailySummary().join('\n'));
}, 60000);

