/* =========================================================
   לוח יומי: בדיקות שלום, תזכורות תרופה, "צריך להיראות עד"
   ========================================================= */
const SCHED_TYPES = {
  checkin: { name: 'בדיקת שלום', icon: '👋', desc: 'בשעה הזו המערכת שואלת "הכל בסדר?". אין תשובה — חירום' },
  med:     { name: 'תרופה', icon: '💊', desc: 'תזכורת בקול, ואישור "לקחתי" בכפתור, בהרמת יד או במילה "לקחתי"' },
  seen:    { name: 'צריך להיראות עד', icon: '⏰', desc: 'אם עד השעה הזו לא נראה היום מול המצלמה — התראה' },
};
Object.assign(REASON_NAMES, { checkin: 'בדיקת שלום', notseen: 'לא נראה היום', med: 'תרופה לא אושרה' });
const localKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayKey = () => localKey(Date.now());
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const hm = (s) => { const [h, m] = (s || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
S.sched = S.sched || {};       // מצב יומי: { 'YYYY-MM-DD:pid:itemId': {st, t, n} }
let medPending = [];           // תזכורות פתוחות כרגע
function schedTick() {
  const now = Date.now(), dk = todayKey(), nm = nowMin();
  // ניקוי מצבים ישנים (שומרים 14 יום לסיכומים)
  for (const k in S.sched) if (/^\d{4}-/.test(k) && k.slice(0, 10) < localKey(now - 14 * 864e5)) delete S.sched[k];
  for (const p of S.people) {
    if (!p.name || !Array.isArray(p.sched)) continue;
    for (const it of p.sched) {
      if (!it.on || !it.time) continue;
      const key = `${dk}:${p.id}:${it.id}`, st = S.sched[key];
      const due = nm >= hm(it.time) && nm < hm(it.time) + 180; // חלון של 3 שעות אחרי השעה
      if (!due && !st) continue;
      if (it.type === 'seen') {
        if (!st && due) { S.sched[key] = { st: p.lastSeen >= dayStart() ? 'ok' : 'missed', t: now }; if (S.sched[key].st === 'missed') { logSafety(p, 'notify', `לא נראה היום עד ${it.time}`); notifyEvent(p, 'notseen', `לא נראה מול המצלמה עד ${it.time}`); } save(); }
      } else if (it.type === 'checkin') {
        if (!st && due) {
          S.sched[key] = { st: 'asked', t: now };
          if (running && p.guard && p.guard.on && S.settings.guardOn) { const s = gs(p.id); s.schedKey = key; trigger(p, 'checkin', `בדיקת שלום של ${it.time}`); }
          else { S.sched[key].st = 'skipped'; notifyEvent(p, 'checkin', `לא בוצעה בדיקת השלום של ${it.time} (המצלמה או השמירה כבויות)`); }
          save();
        }
      } else if (it.type === 'med') {
        if (!st && due) { S.sched[key] = { st: 'pending', t: now, n: 1 }; medPending.push({ key, pid: p.id, it }); medAnnounce(p, it); save(); renderGuard(); }
        else if (st && st.st === 'pending') {
          if (!medPending.some((m) => m.key === key)) medPending.push({ key, pid: p.id, it });
          const grace = (it.grace || 30) * 60000;
          if (now - st.t > grace) { st.st = 'missed'; medPending = medPending.filter((m) => m.key !== key); logSafety(p, 'notify', `תרופה לא אושרה: ${it.text || ''} (${it.time})`); notifyEvent(p, 'med', `לא אושרה נטילה של ${it.text || 'התרופה'} משעה ${it.time}`); save(); renderGuard(); }
          else if (now - st.t > st.n * 10 * 60000 && st.n < 3) { st.n++; medAnnounce(p, it); save(); }
        }
      }
    }
  }
}
function medAnnounce(p, it) {
  const f = p.gender === 'f';
  speak(`${p.name}, הגיע הזמן ל${it.text || 'תרופה'}. אחרי ש${f ? 'תיקחי' : 'תיקח'}, ${f ? 'תגידי' : 'תגיד'} לקחתי או ${f ? 'תרימי' : 'תרים'} יד`, false);
  toast(p, `💊 ${p.name}: ${it.text || 'תרופה'}`, `תזכורת של ${it.time} — לחץ "לקחתי" בלשונית שמירה`);
}
function medConfirm(key, how) {
  const st = S.sched[key]; if (!st || st.st !== 'pending') return;
  const m = medPending.find((x) => x.key === key); const p = m && byId(m.pid);
  st.st = 'ok'; st.how = how; st.done = Date.now();
  medPending = medPending.filter((x) => x.key !== key);
  if (p) { logSafety(p, 'resolved', `לקח ${m.it.text || 'תרופה'} (${how})`); speak(`תודה ${p.name}, רשמתי`, false); }
  save(); renderGuard();
}
// אישור תרופה בהרמת יד או בקול — נקרא מתוך טיק השמירה ומזיהוי הדיבור
function medGesture(pid, how) { medPending.filter((m) => m.pid === pid).forEach((m) => medConfirm(m.key, how)); }
setInterval(() => { schedTick(); arrTick(); }, 20000);

