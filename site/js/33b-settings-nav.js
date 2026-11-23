/* =========================================================
   הגדרות מסודרות: במקום גלילה ארוכה — פרקים שנפתחים בלחיצה, עם שורת חיפוש
   הפרקים נבנים מהכותרות שכבר קיימות בחלון ההגדרות (sethead). השורות עצמן לא משתנות.
   ========================================================= */
const SETNAV = { secs: [], desc: {
  'זיהוי ותצוגה': 'רמת ודאות, טווח, ברכה קולית וצלילים',
  'שמירה ובטיחות': 'סביבת המצלמה, רגישות, שעות שינה, שלד ומראה',
  'חיישני שמע': 'בכי, צעקה, רעש חזק, אזעקת עשן, הרגעה',
  'אימות חכם': 'קודם שואלים את האחראי, ורק אחר כך אזעקה',
  'מצב בית ריק ואזורים': 'התראה על כל אדם כשאין אף אחד בבית',
  'חיות מחמד': 'זיהוי כלב וחתול',
  'כמה מצלמות בבית': 'סנכרון בין מכשירים',
  'התראות לטלפון': 'ntfy, התראות דפדפן, Webhook',
  'כללי': 'קטעי וידאו, סיכום יומי, גיבוי ועוד',
} };
function buildSetNav() {
  const box = document.querySelector('#setModal .setbox'); if (!box || box._nav) return; box._nav = true;
  const title = box.querySelector('h3');
  const nodes = Array.from(box.children).filter((n) => n !== title && !n.classList.contains('xclose'));
  const groups = []; let cur = { head: null, name: '🎯 זיהוי ותצוגה', nodes: [] };
  for (const n of nodes) {
    if (n.classList.contains('sethead')) { if (cur.nodes.length || cur.head) groups.push(cur); cur = { head: n, name: n.textContent.trim(), nodes: [] }; }
    else cur.nodes.push(n);
  }
  groups.push(cur);
  const search = document.createElement('input');
  search.type = 'search'; search.className = 'field setsearch'; search.id = 'setSearch'; search.placeholder = '🔎 חיפוש בהגדרות'; search.setAttribute('aria-label', 'חיפוש בהגדרות'); search.autocomplete = 'off';
  title.after(search);
  const none = document.createElement('div'); none.className = 'hint2 hidden'; none.id = 'setNone'; none.textContent = 'לא נמצאה הגדרה כזו';
  let after = search;
  groups.forEach((g, i) => {
    const sec = document.createElement('section'); sec.className = 'setsec';
    const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'setsec-h'; btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'setsec' + i);
    const plain = g.name.replace(/^[^֐-׿A-Za-z]+/, '').trim(), icon = g.name.slice(0, g.name.length - plain.length).trim() || '⚙️';
    btn.innerHTML = `<span class="si2">${icon}</span><span class="st2"><b>${esc(plain)}</b><small>${esc(SETNAV.desc[plain] || '')}</small></span><span class="chev" aria-hidden="true">‹</span>`;
    const body = document.createElement('div'); body.className = 'setsec-b hidden'; body.id = 'setsec' + i;
    g.nodes.forEach((n) => body.appendChild(n));
    if (g.head) { g.head.classList.add('hidden'); body.prepend(g.head); } // נשאר בשביל קישורים פנימיים (למשל camSec)
    sec.append(btn, body); after.after(sec); after = sec;
    const rec = { sec, btn, body, head: g.head, open: false };
    btn.onclick = () => setSecOpen(rec, !rec.open);
    SETNAV.secs.push(rec);
  });
  after.after(none);
  search.oninput = () => setFilter(search.value.trim());
}
function setSecOpen(rec, open) { rec.open = open; rec.body.classList.toggle('hidden', !open); rec.btn.setAttribute('aria-expanded', String(open)); rec.sec.classList.toggle('open', open); }
// פתיחת פרק לפי מזהה של כותרת (למשל 'camSec')
function setOpenSec(id) { const r = SETNAV.secs.find((x) => x.head && x.head.id === id); if (r) { setSecOpen(r, true); r.sec.scrollIntoView({ block: 'start' }); } }
function setFilter(q) {
  let any = false;
  for (const r of SETNAV.secs) {
    let hit = 0;
    for (const n of r.body.children) {
      if (n === r.head) continue;
      const m = !q || n.textContent.includes(q); n.classList.toggle('setmiss', !m); if (m) hit++;
    }
    r.sec.classList.toggle('hidden', !!q && !hit);
    if (q) { r.body.classList.toggle('hidden', !hit); r.btn.setAttribute('aria-expanded', String(!!hit)); } else setSecOpen(r, r.open);
    if (hit) any = true;
  }
  $('setNone').classList.toggle('hidden', !q || any);
}
buildSetNav();
