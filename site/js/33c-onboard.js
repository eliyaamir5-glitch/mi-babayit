/* =========================================================
   מסך פתיחה ובחירת סביבה
   בפעם הראשונה: "איפה המצלמה?" ← כל ההגדרות מכוונות למומלץ לסביבה ← הסבר במילים מה הוגדר.
   אותו חלון נפתח גם מהכפתור שבכותרת (שם הסביבה), כדי להחליף סביבה בכל רגע.
   ========================================================= */
const OB = { env: 'living', first: false };
function openOnboard(first) {
  OB.first = !!first; OB.env = S.settings.env || 'living';
  if (first) { S.settings.onboarded = true; save(); } // מוצג פעם אחת בלבד, גם אם סוגרים ב־✕
  $('obTitle').textContent = first ? 'ברוכים הבאים ל"מי בבית"' : 'איפה המצלמה עומדת?';
  $('obSub').textContent = first ? 'איפה המצלמה עומדת? נכוון את כל ההגדרות למומלץ למקום הזה. אפשר לשנות בכל רגע.' : 'בחירת סביבה מכוונת את כל ההגדרות למומלץ למקום הזה.';
  $('obSkip').textContent = first ? 'דלג — השאר כמו שזה' : 'ביטול';
  obStep(1); renderObGrid();
  $('obModal').classList.add('open');
}
function obStep(n) { $('obStep1').classList.toggle('hidden', n !== 1); $('obStep2').classList.toggle('hidden', n !== 2); }
function renderObGrid() {
  $('obGrid').innerHTML = Object.entries(ENVS).map(([k, e]) => `<button type="button" role="radio" aria-checked="${OB.env === k}" data-ob="${k}" class="${OB.env === k ? 'on' : ''}"><span class="oi">${e.icon}</span><span><b>${e.name}</b><small>${e.note}</small></span></button>`).join('');
}
$('obGrid').onclick = (e) => { const b = e.target.closest('[data-ob]'); if (b) { OB.env = b.dataset.ob; renderObGrid(); } };
$('obNext').onclick = () => {
  const e = ENVS[OB.env];
  $('obTitle2').textContent = `${e.icon} ${e.name} — ההגדרות המומלצות`;
  $('obList').innerHTML = envSummary(OB.env).map((l) => `<li>${esc(l)}</li>`).join('');
  $('obTip').classList.toggle('hidden', !e.tip); $('obTip').textContent = e.tip ? '💡 ' + e.tip : '';
  obStep(2);
};
$('obBack').onclick = () => obStep(1);
function obFinish(apply) {
  if (apply) applyEnv(OB.env, OB.first);
  S.settings.onboarded = true; save();
  closeModal($('obModal'));
  if (apply && OB.first) toast(null, `${ENVS[OB.env].icon} מוכן: ${ENVS[OB.env].name}`, 'לחץ "הפעל מצלמה" כדי להתחיל');
}
$('obDone').onclick = () => obFinish(true);
$('obSkip').onclick = () => obFinish(false);
$('envPill').onclick = () => openOnboard(false);
