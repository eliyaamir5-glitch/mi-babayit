/* =========================================================
   נגישות
   ========================================================= */
function applyA11y() {
  const a = S.settings.a11y || (S.settings.a11y = { size: 1 });
  document.body.style.zoom = a.size && a.size !== 1 ? a.size : '';
  ['contrast', 'motion', 'focus', 'font', 'big'].forEach((k) => document.body.classList.toggle('a11y-' + k, !!a[k]));
  document.querySelectorAll('[data-a11y]').forEach((b) => { b.classList.toggle('on', !!a[b.dataset.a11y]); b.setAttribute('aria-pressed', !!a[b.dataset.a11y]); });
  document.querySelectorAll('#a11yModal [data-sz]').forEach((b) => b.classList.toggle('on', +b.dataset.sz === (a.size || 1)));
  $('a11ySizeTxt').textContent = `${Math.round((a.size || 1) * 100)}%`;
}
$('a11yBtn').onclick = () => { applyA11y(); $('a11yModal').classList.add('open'); };
$('a11yClose').onclick = () => $('a11yModal').classList.remove('open');
$('a11yModal').addEventListener('click', (e) => {
  const sz = e.target.closest('[data-sz]'); if (sz) { S.settings.a11y.size = +sz.dataset.sz; save(); applyA11y(); }
  const t = e.target.closest('[data-a11y]'); if (t) { const k = t.dataset.a11y; S.settings.a11y[k] = !S.settings.a11y[k]; save(); applyA11y(); }
});
$('a11yReset').onclick = () => { S.settings.a11y = { size: 1 }; save(); applyA11y(); };
$('a11yStmtBtn').onclick = () => { renderStmt(); $('stmtModal').classList.add('open'); };
$('stmtClose').onclick = () => $('stmtModal').classList.remove('open');
function renderStmt() {
  const c = S.settings.a11yContact || {};
  $('stmtBody').innerHTML = `
    <p>אנו רואים חשיבות רבה בהנגשת האפליקציה "מי בבית" לכל אדם, כולל אנשים עם מוגבלות. האפליקציה תוכננה לפי הנחיות ת"י 5568 המבוסס על WCAG 2.0 ברמה AA.</p>
    <p><b>התאמות שבוצעו:</b></p>
    <ul>
      <li>תפריט נגישות: הגדלת טקסט, ניגודיות גבוהה, עצירת אנימציות, הדגשת פוקוס, גופן קריא וכפתורים גדולים.</li>
      <li>הפעלה מלאה במקלדת, כולל סגירת חלונות במקש Esc ושמירת הפוקוס בתוך חלון פתוח.</li>
      <li>תוויות לקוראי מסך לכפתורים, לחלונות ולהודעות, והודעות מצב שמוקראות אוטומטית.</li>
      <li>כל מה שהמערכת אומרת בקול יכול להופיע גם בכתוביות, וכל התראה קולית מלווה בהתראה חזותית.</li>
      <li>מענה ל"הכל בסדר?" בכמה דרכים: תנועה, הרמת יד, דיבור או לחיצה על כפתור.</li>
      <li>כיוון מימין לשמאל ושפת עברית מוגדרים בקוד, והתצוגה מתאימה לטלפון, לטאבלט ולמחשב.</li>
    </ul>
    <p><b>מגבלות ידועות:</b> הזיהוי מתבסס על מצלמה ומיקרופון. שידור הווידאו עצמו אינו כולל תיאור קולי. זהו כלי עזר בלבד ואינו מכשיר רפואי.</p>
    <p><b>נתקלתם בבעיית נגישות?</b> נשמח לשמוע ולתקן.<br>רכז/ת נגישות: ${esc(c.name || '— יש למלא בהגדרות —')}<br>טלפון: <bdi dir="ltr">${esc(c.phone || '—')}</bdi> · דוא"ל: <bdi dir="ltr">${esc(c.email || '—')}</bdi></p>
    <p class="hint2">עודכן לאחרונה: ${esc(c.date || new Date().toLocaleDateString('he-IL'))}</p>`;
}
// כתוביות לכל דבר שהמערכת אומרת
let capTimer = 0;
function showCaption(text) {
  if (!S.settings.a11y || !S.settings.a11y.captions) return;
  const el = $('captions'); el.textContent = '🔊 ' + text; el.classList.remove('hidden');
  clearTimeout(capTimer); capTimer = setTimeout(() => el.classList.add('hidden'), Math.max(3000, text.length * 90));
}
// תוויות ותפקידים לקוראי מסך
document.querySelectorAll('.tabs .tab').forEach((t) => { t.setAttribute('role', 'tab'); });
document.querySelector('.tabs').setAttribute('role', 'tablist');

function normalizeState() {
  S.safety = S.safety || []; S.log = S.log || []; S.sched = S.sched || {}; S.clips = S.clips || []; S.zones = S.zones || []; S.expect = S.expect || []; S.pets = S.pets || [];
  S.settings.pets = Object.assign({ on: false, missH: 0 }, S.settings.pets || {});
  if (!S.settings.devId) S.settings.devId = 'd' + Math.random().toString(36).slice(2, 10);
  if (!S.settings.camName) S.settings.camName = 'מצלמה ' + (10 + Math.floor(Math.random() * 90));
  const d = JSON.parse(JSON.stringify(SND_DEFAULT)), sv = S.settings.snd || {}; for (const k in d) { if (typeof d[k] === 'object') d[k] = Object.assign(d[k], sv[k] || {}); else if (sv[k] != null) d[k] = sv[k]; } S.settings.snd = d;
  S.people.forEach((p) => {
    if (p.guard && !p.guard.v2) { const ov = p.guard.ov || {}; ['still', 'alone', 'away'].forEach((k) => { if (ov[k] && ov[k].val != null) ov[k].val *= 60; }); p.guard.v2 = true; }
    p.samples = (p.samples || []).map((x) => (Array.isArray(x) ? { e: Array.from(norm(x)), img: p.thumb, t: 0 } : x));
  });
  // ניקוי "לא מזוהים" ישנים: שומרים עד 40, מוחקים קודם את מי שלא נראה הכי הרבה זמן
  const unk = S.people.filter((p) => !p.name).sort((a, b) => b.lastSeen - a.lastSeen);
  if (unk.length > 40) { const drop = new Set(unk.slice(40).map((p) => p.id)); S.people = S.people.filter((p) => !drop.has(p.id)); }
}
