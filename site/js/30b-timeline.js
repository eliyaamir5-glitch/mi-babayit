/* =========================================================
   ציר הזמן של היום — מי היה מול המצלמה ומתי, במבט אחד
   נשמרים רק טווחי זמן לכל אדם (התחלה וסוף), להיום ולאתמול. מוצג בראש לשונית "יומן".
   ========================================================= */
const PRES = { gap: 2 * 60000, savedAt: 0 };
const presDay = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function presTick(now) {
  if (!running) return;
  const ids = presentIds(); if (!ids.size) return;
  S.pres = S.pres || {};
  const day = presDay(now), d = S.pres[day] || (S.pres[day] = {});
  for (const id of ids) {
    const sp = d[id] || (d[id] = []), last = sp[sp.length - 1];
    if (last && now - last[1] < PRES.gap) last[1] = now; else sp.push([now, now]);
  }
  if (now - PRES.savedAt > 60000) {
    PRES.savedAt = now;
    const keep = new Set([day, presDay(now - 86400000)]); for (const k in S.pres) if (!keep.has(k)) delete S.pres[k];
    save();
  }
}
function timelineHTML() {
  const now = Date.now(), day = presDay(now), d = (S.pres && S.pres[day]) || {};
  const start = new Date(); start.setHours(0, 0, 0, 0); const t0 = start.getTime(), DAY = 86400000;
  const pct = (t) => Math.max(0, Math.min(100, (t - t0) / DAY * 100));
  const rows = Object.keys(d).map((id) => ({ p: byId(id), sp: d[id] })).filter((r) => r.p && r.sp.length)
    .sort((a, b) => (b.p.name ? 1 : 0) - (a.p.name ? 1 : 0) || b.sp[b.sp.length - 1][1] - a.sp[a.sp.length - 1][1]);
  const events = (S.safety || []).filter((e) => e.t >= t0 && ['emergency', 'ask', 'notify', 'zone'].includes(e.ev));
  if (!rows.length && !events.length) return '';
  const ticks = [0, 6, 12, 18, 24].map((h) => `<i style="right:${h / 24 * 100}%">${String(h).padStart(2, '0')}</i>`).join('');
  const nowMark = `<span class="tlnow" style="right:${pct(now)}%"></span>`;
  let html = `<div class="tlcard" role="group" aria-label="ציר הזמן של היום"><div class="tlhead"><b>היום במבט אחד</b><span>מי היה מול המצלמה ומתי</span></div>`;
  for (const r of rows.slice(0, 12)) {
    const total = r.sp.reduce((a, s) => a + Math.max(60000, s[1] - s[0]), 0), last = r.sp[r.sp.length - 1][1];
    const segs = r.sp.map((s) => `<span class="tlseg${r.p.name ? '' : ' unk'}" style="right:${pct(s[0])}%;width:${Math.max(0.6, pct(s[1]) - pct(s[0]))}%" title="${hhmm(s[0])}–${hhmm(s[1])}"></span>`).join('');
    html += `<div class="tlrow" aria-label="${esc(nameOf(r.p))}: נראה היום ${fmtDur(total)}, לאחרונה ב־${hhmm(last)}"><div class="tlname">${r.p.thumb ? `<img src="${r.p.thumb}" alt="">` : ''}<span><b>${esc(nameOf(r.p))}</b><small>${Math.round(total / 60000) >= 60 ? fmtDur(total) : Math.max(1, Math.round(total / 60000)) + ' דק׳'}</small></span></div><div class="tlbar">${segs}${nowMark}</div></div>`;
  }
  if (events.length) {
    const dots = events.slice(0, 60).map((e) => `<span class="tlev ${e.ev}" style="right:${pct(e.t)}%" title="${hhmm(e.t)} · ${esc(e.text || '')}"></span>`).join('');
    html += `<div class="tlrow" aria-label="${events.length} אירועים היום"><div class="tlname"><span><b>⚡ אירועים</b><small>${events.length} היום</small></span></div><div class="tlbar ev">${dots}${nowMark}</div></div>`;
  }
  return html + `<div class="tlticks">${ticks}</div></div>`;
}
