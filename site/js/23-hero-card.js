/* =========================================================
   כרטיס מצב במבט אחד
   ========================================================= */
function heroCard() {
  const list = guarded(), now = Date.now();
  const em = list.filter((p) => G[p.id] && G[p.id].state === 'emergency');
  const ask = list.filter((p) => G[p.id] && G[p.id].state === 'asking');
  const meds = medPending.map((m) => ({ m, p: byId(m.pid) })).filter((x) => x.p);
  let cls = 'ok', title = 'הכל בסדר', sub = '';
  if (!running) { cls = 'idle'; title = 'המצלמה כבויה'; sub = 'לחץ "הפעל מצלמה" כדי להתחיל לשמור'; }
  else if (!S.settings.guardOn || !list.length) { cls = 'idle'; title = list.length ? 'השמירה כבויה' : 'אין אנשים בשמירה'; sub = list.length ? 'הפעל את המתג למטה' : 'פתח פרופיל והפעל "שמירה פעילה"'; }
  if (running && meds.length) { cls = 'warn'; title = 'תזכורת ממתינה'; sub = meds.map((x) => `${x.p.name}: ${x.m.it.text || 'תרופה'}`).join(' · '); }
  const ver = list.filter((p) => G[p.id] && G[p.id].state === 'verify');
  if (running && ver.length) { cls = 'warn'; title = `ממתין לאישור: ${ver.map((p) => p.name).join(', ')}`; sub = ver.map((p) => `${p.name}: ${REASON_NAMES[G[p.id].reason]}`).join(' · ') + ' — נשלח לטלפון'; }
  if (running && ask.length) { cls = 'warn'; title = `בודק את ${ask.map((p) => p.name).join(', ')}`; sub = 'שואל "הכל טוב?"'; }
  if (em.length) { cls = 'bad'; title = `חירום: ${em.map((p) => p.name).join(', ')}`; sub = em.map((p) => REASON_NAMES[G[p.id].reason]).join(' · ') + (em.some((p) => G[p.id].acked) ? ' · בן משפחה מטפל' : ''); }
  const seen = list.map((p) => { const s = G[p.id]; return `<span>${esc(p.name)}: ${s && s.lastSeen ? (now - s.lastSeen < 5000 ? 'כאן עכשיו' : 'נראה ' + ago(s.lastSeen)) : 'עוד לא נראה'}${emoLabel(p.id) ? ' ' + emoLabel(p.id) : ''}</span>`; }).join('');
  const verBtns = list.filter((p) => G[p.id] && G[p.id].state === 'verify').map((p) => `<button class="medok" data-vok="${p.id}">✅ ${esc(p.name)} — זה בסדר</button><button class="medok alarm" data-valarm="${p.id}">🚨 הפעל אזעקה</button>`).join('');
  const medBtns = verBtns + meds.map((x) => `<button class="medok" data-key="${x.m.key}">💊 ${esc(x.p.name)} לקח — אשר</button>`).join('');
  const sooth = SOOTHE.node ? `<button class="medok" data-sooth="stop">⏹ עצור ${SOOTHE.kind === 'noise' ? 'רעש לבן' : 'שיר ערש'}</button>` : '';
  const hem = Object.values(HOUSE.em);
  if (hem.length && cls !== 'bad') { cls = 'bad'; title = `חירום במצלמת ${hem[0].cam}: ${hem[0].name}`; sub = REASON_NAMES[hem[0].reason] || ''; }
  if (S.settings.armed && cls !== 'bad') { cls = 'warn'; title = '🔒 מצב בית ריק פעיל'; sub = 'כל אדם שיזוהה יקפיץ התראה'; }
  return `<div class="hero ${cls}"><div class="htitle">${cls === 'ok' ? '✅' : cls === 'warn' ? '⚠️' : cls === 'bad' ? '🚨' : '⏸️'} ${esc(title)}</div>${sub ? `<div class="hsub">${esc(sub)}</div>` : ''}${seen ? `<div class="hseen">${seen}</div>` : ''}${medBtns || sooth ? `<div class="hbtns">${medBtns}${sooth}</div>` : ''}</div>`;
}

