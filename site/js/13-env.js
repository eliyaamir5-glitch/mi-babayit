/* =========================================================
   סביבת המצלמה — כל סביבה מכוונת את הרמות
   ========================================================= */
const ENVS = {
  living:  { name: 'סלון', icon: '🛋️', motionSens: 5, noiseDb: 26, cry: false, scream: true, loud: true, smoke: true, stillMult: 1, fallLying: true, privacy: false, sleepOn: false, note: 'איזון רגיל לחלל משפחתי' },
  bedroom: { name: 'חדר שינה', icon: '🛏️', motionSens: 6, noiseDb: 20, cry: false, scream: true, loud: true, smoke: true, stillMult: 1, fallLying: false, privacy: false, sleepOn: true, note: 'שכיבה במיטה לא נחשבת נפילה, ובשעות השינה אין בדיקת "לא זז"' },
  nursery: { name: 'חדר תינוק', icon: '👶', motionSens: 8, noiseDb: 14, cry: true, scream: false, loud: true, smoke: true, stillMult: 1, fallLying: false, privacy: false, sleepOn: false, note: 'רגיש לתנועות קטנות ולבכי, גם בשקט של הלילה' },
  kids:    { name: 'חדר ילדים', icon: '🧸', motionSens: 6, noiseDb: 22, cry: true, scream: true, loud: true, smoke: true, stillMult: 1, fallLying: false, privacy: false, sleepOn: false, note: 'בכי וצעקות, ושכיבה במיטה לא נחשבת נפילה' },
  kitchen: { name: 'מטבח', icon: '🍳', motionSens: 4, noiseDb: 32, cry: false, scream: true, loud: false, smoke: true, stillMult: 1, fallLying: true, privacy: false, sleepOn: false, note: 'סף רעש גבוה (סירים וכלים), אזעקת עשן פעילה' },
  bath:    { name: 'אמבטיה / מקלחת', icon: '🚿', motionSens: 6, noiseDb: 34, cry: false, scream: true, loud: true, smoke: false, stillMult: 0.5, fallLying: true, privacy: true, sleepOn: false, note: 'מצב פרטיות (בלי תמונות), "לא זז" מחמיר פי 2, רגיש לנפילה' },
  office:  { name: 'משרד / חדר עבודה', icon: '💼', motionSens: 5, noiseDb: 24, cry: false, scream: true, loud: true, smoke: true, stillMult: 1.5, fallLying: true, privacy: false, sleepOn: false, note: 'ישיבה ממושכת מול מחשב — "לא זז" מקל פי 1.5' },
  yard:    { name: 'חצר / מרפסת', icon: '🌳', motionSens: 4, noiseDb: 34, cry: false, scream: true, loud: false, smoke: false, stillMult: 1, fallLying: true, privacy: false, sleepOn: false, note: 'רעשי חוץ ורוח — ספים גבוהים יותר' },
};
function envCfg() {
  const e = ENVS[(S.settings && S.settings.env) || 'living'] || ENVS.living;
  return Object.assign({}, e, { privacy: !!(S.settings && S.settings.privacy) });
}
function applyEnv(id) {
  const e = ENVS[id]; if (!e) return;
  const st = S.settings, snd = st.snd;
  st.env = id; st.motionSens = e.motionSens; st.privacy = e.privacy; st.sleepOn = e.sleepOn;
  snd.noiseDb = e.noiseDb; snd.cry.on = e.cry; snd.scream.on = e.scream; snd.loud.on = e.loud; snd.smoke.on = e.smoke;
  save(); syncSettings(); renderGuard();
  toast(null, `${e.icon} סביבה: ${e.name}`, e.note);
}

