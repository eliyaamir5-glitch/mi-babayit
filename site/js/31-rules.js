/* =========================================================
   שמירה ובטיחות — נתונים וכללים
   ========================================================= */
const AGE_NAMES = { baby: 'תינוק', child: 'ילד', teen: 'נער', adult: 'מבוגר', senior: 'גיל הזהב' };
const CONDS = [
  { id: 'allergy', name: 'אלרגיה' }, { id: 'epilepsy', name: 'אפילפסיה' }, { id: 'heart', name: 'מחלת לב' },
  { id: 'diabetes', name: 'סוכרת' }, { id: 'asthma', name: 'אסתמה' }, { id: 'fallrisk', name: 'סכנת נפילה' },
  { id: 'dementia', name: 'בלבול / דמנציה' }, { id: 'other', name: 'אחר' },
];
const RULES = {
  // כל הזמנים בשניות. אפשר לקבוע מ־3 שניות ועד 24 שעות
  still:  { name: 'לא זז', desc: 'אין תנועה במשך הזמן שנקבע', timed: true, val: 1800, min: 3, max: 86400 },
  fall:   { name: 'נפילה', desc: 'ירידה חדה של הראש או מעבר לשכיבה', timed: false },
  tremor: { name: 'תנועה חריגה / רעידות', desc: 'תנועה חזקה וחוזרת במקום', timed: true, val: 8, min: 3, max: 600 },
  alone:  { name: 'נשאר לבד', desc: 'בלי אף מבוגר מול המצלמה', timed: true, val: 180, min: 3, max: 86400 },
  away:   { name: 'יצא מהטווח', desc: 'נעלם מהמצלמה ולא חזר', timed: true, val: 600, min: 3, max: 86400 },
  floor:  { name: 'שוכב על הרצפה', desc: 'שכיבה מחוץ למיטה או לספה (שינה במיטה או בספה לא נחשבת)', timed: true, val: 30, min: 5, max: 3600 },
  distress: { name: 'מצוקה רגשית', desc: 'פחד, עצב או כעס חזקים לאורך זמן (ניסיוני)', timed: true, val: 60, min: 5, max: 3600 },
};
function ageGroupOf(p) {
  if (p.ageGroup) return p.ageGroup;
  if (p.birthYear) {
    const a = new Date().getFullYear() - p.birthYear;
    return a < 2 ? 'baby' : a < 12 ? 'child' : a < 18 ? 'teen' : a < 65 ? 'adult' : 'senior';
  }
  return 'adult';
}
const isAdult = (p) => ['adult', 'senior'].includes(ageGroupOf(p));
const isKid = (p) => ['baby', 'child'].includes(ageGroupOf(p));
function autoRules(p) {
  const r = {}; for (const k in RULES) r[k] = { on: false, val: RULES[k].val, set: false };
  const en = (k, v) => { r[k].on = true; if (v != null) { r[k].val = r[k].set ? Math.min(r[k].val, v) : v; r[k].set = true; } };
  const ag = ageGroupOf(p);
  if (ag === 'baby') { en('alone', 60); en('away', 120); en('tremor', 10); }
  if (ag === 'child') { en('alone', 180); en('away', 300); en('fall'); }
  if (ag === 'teen') { en('fall'); }
  if (ag === 'adult') { en('fall'); en('still', 1800); en('floor', 30); }
  if (ag === 'senior') { en('fall'); en('still', 1200); en('away', 900); en('floor', 20); }
  const c = p.conds || {};
  if (c.epilepsy) { en('tremor', 8); en('fall'); en('floor', 15); }
  if (c.heart) { en('still', 600); en('fall'); }
  if (c.diabetes) { en('still', 1200); en('fall'); }
  if (c.asthma) { en('still', 1200); }
  if (c.fallrisk) { en('fall'); en('still', 900); en('floor', 15); }
  if (c.dementia) { en('away', 600); en('still', 1800); }
  if (c.allergy) { en('still', 1200); }
  if (c.other) { en('fall'); }
  for (const k in r) delete r[k].set;
  // התאמה לסביבת המצלמה (למשל במקלחת "לא זז" מחמיר פי 2)
  const env = typeof envCfg === 'function' ? envCfg() : null;
  if (env && env.stillMult && r.still) r.still.val = Math.max(RULES.still.min, Math.round(r.still.val * env.stillMult));
  if (env && env.fallOff) r.fall.on = false;
  return r;
}
function effRules(p) {
  const a = autoRules(p), ov = (p.guard && p.guard.ov) || {}, out = {};
  for (const k in a) out[k] = { on: ov[k] && ov[k].on != null ? ov[k].on : a[k].on, val: ov[k] && ov[k].val != null ? ov[k].val : a[k].val, manual: !!ov[k] };
  return out;
}
const askCfg = (p) => ({ n: (p.guard && p.guard.askN) || 3, gap: (p.guard && p.guard.askGap) || 15, skip: ageGroupOf(p) === 'baby' });
// זמן קריא: "45 שניות", "2 דקות", "1.5 שעות"
function fmtSec(sec) {
  sec = Math.round(sec);
  if (sec < 60) return sec === 1 ? 'שנייה' : `${sec} שניות`;
  if (sec < 3600) { const m = sec / 60; return m === 1 ? 'דקה' : `${+m.toFixed(1)} דקות`; }
  const h = sec / 3600; return h === 1 ? 'שעה' : `${+h.toFixed(1)} שעות`;
}
const UNITS = [{ id: 's', name: 'שניות', m: 1 }, { id: 'm', name: 'דקות', m: 60 }, { id: 'h', name: 'שעות', m: 3600 }];
function bestUnit(sec) { return sec >= 3600 && sec % 3600 === 0 ? 'h' : sec >= 60 && sec % 60 === 0 ? 'm' : 's'; }
function timeInput(attr, sec, disabled, units) {
  const u = bestUnit(sec), U = UNITS.filter((x) => !units || units.includes(x.id));
  const uu = U.find((x) => x.id === u) || U[0];
  return `<span class="tin"><input class="field sm" type="number" min="1" step="any" value="${+(sec / uu.m).toFixed(2)}" ${attr} ${disabled ? 'disabled' : ''}><select class="field sm" data-unit="1" ${disabled ? 'disabled' : ''}>${U.map((x) => `<option value="${x.id}" ${x.id === uu.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></span>`;
}
function readTime(wrap) { const n = +wrap.querySelector('input').value || 0, u = UNITS.find((x) => x.id === wrap.querySelector('select').value) || UNITS[0]; return n * u.m; }
const guarded = () => S.people.filter((p) => p.name && p.guard && p.guard.on);

