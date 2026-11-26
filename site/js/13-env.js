/* =========================================================
   סביבת המצלמה — כל סביבה מכוונת את הרמות
   ========================================================= */
// לכל סביבה: הרמות המומלצות. applyEnv מחיל את כולן בבת אחת, ו־envSummary מסביר במילים מה הוגדר.
// mic: null = לא נוגעים במיקרופון; true = מדליקים (חדר תינוק/ילדים/מבוגר — שם הקול חשוב)
const ENV_BASE = { motionSens: 5, noiseDb: 26, cry: false, scream: true, loud: true, smoke: true, glass: false, stillMult: 1, fallLying: true, privacy: false, sleepOn: false,
  quality: 'balanced', emotions: true, looks: true, skeleton: false, clips: true, soothe: false, mic: null, tip: '' };
const ENVS = {
  living:   { name: 'סלון', icon: '🛋️', note: 'איזון רגיל לחלל משפחתי', tip: 'כדאי לסמן את הספה כאזור, כדי שמנוחה עליה לא תיחשב נפילה' },
  entrance: { name: 'כניסה לבית', icon: '🚪', motionSens: 5, noiseDb: 30, loud: false, smoke: false, glass: true, quality: 'far', emotions: false, note: 'מזהה מי נכנס ומי יוצא, גם מרחוק', tip: 'סמן את הדלת כאזור — כך תקבל "מי הגיע" והגעות צפויות' },
  bedroom:  { name: 'חדר שינה', icon: '🛏️', motionSens: 6, noiseDb: 20, fallLying: false, sleepOn: true, emotions: false, note: 'שכיבה במיטה לא נחשבת נפילה, ובשעות השינה אין בדיקת "לא זז"' },
  nursery:  { name: 'חדר תינוק', icon: '👶', motionSens: 8, noiseDb: 14, cry: true, scream: false, fallLying: false, soothe: true, mic: true, note: 'רגיש לתנועות קטנות ולבכי, גם בשקט של הלילה', tip: 'סמן את המיטה כאזור. המיקרופון יופעל כדי לשמוע בכי' },
  kids:     { name: 'חדר ילדים', icon: '🧸', motionSens: 6, noiseDb: 22, cry: true, fallLying: false, mic: true, note: 'בכי וצעקות, ושכיבה במיטה לא נחשבת נפילה', tip: 'אפשר לסמן חלון או שקע כ"אזור אסור"' },
  elder:    { name: 'חדר של אדם מבוגר', icon: '🧓', motionSens: 6, noiseDb: 22, stillMult: 0.75, sleepOn: true, mic: true, note: 'רגיש לנפילה ולחוסר תנועה, ומקשיב לקריאה לעזרה', tip: 'חשוב: סמן את המיטה והכורסה כאזורים, כדי ששכיבה בהן לא תיחשב נפילה' },
  kitchen:  { name: 'מטבח', icon: '🍳', motionSens: 4, noiseDb: 32, loud: false, emotions: false, note: 'סף רעש גבוה (סירים וכלים), אזעקת עשן פעילה', tip: 'אפשר לסמן את הכיריים כ"אזור אסור" לילדים' },
  bath:     { name: 'אמבטיה / מקלחת', icon: '🚿', motionSens: 6, noiseDb: 34, smoke: false, stillMult: 0.5, privacy: true, quality: 'fast', emotions: false, looks: false, skeleton: true, clips: false, note: 'פרטיות מלאה: רואים רק שלד, בלי תמונות ובלי קטעי וידאו. "לא זז" מחמיר פי 2' },
  office:   { name: 'משרד / חדר עבודה', icon: '💼', motionSens: 5, noiseDb: 24, stillMult: 1.5, emotions: false, note: 'ישיבה ממושכת מול מחשב — "לא זז" מקל פי 1.5' },
  yard:     { name: 'חצר / מרפסת', icon: '🌳', motionSens: 4, noiseDb: 34, loud: false, smoke: false, glass: true, quality: 'far', emotions: false, note: 'זיהוי למרחקים, וספי רעש גבוהים בגלל רוח ורעשי חוץ', tip: 'סמן את השער או הדלת כאזור כניסה' },
};
for (const k in ENVS) ENVS[k] = Object.assign({}, ENV_BASE, ENVS[k]);
function envCfg() {
  const e = ENVS[(S.settings && S.settings.env) || 'living'] || ENVS.living;
  return Object.assign({}, e, { privacy: !!(S.settings && S.settings.privacy) });
}
function applyEnv(id, quiet) {
  const e = ENVS[id]; if (!e) return;
  const st = S.settings, snd = st.snd;
  st.env = id; st.motionSens = e.motionSens; st.privacy = e.privacy; st.sleepOn = e.sleepOn;
  st.quality = e.quality; st.emotions = e.emotions; if (!e.looks) { st.looks = false; st.bodySharp = false; } st.skeleton = e.skeleton; st.clips = e.clips;
  snd.noiseDb = e.noiseDb; snd.cry.on = e.cry; snd.scream.on = e.scream; snd.loud.on = e.loud; snd.smoke.on = e.smoke; snd.glass.on = e.glass; snd.soothe = e.soothe;
  if (e.mic) snd.on = true;
  save(); syncSettings(); renderGuard();
  if (running) { syncAudio(); }
  if (!quiet) toast(null, `${e.icon} סביבה: ${e.name}`, 'כל ההגדרות כוונו למומלץ למקום הזה');
}
// מה הוגדר, במילים פשוטות (למסך הפתיחה ולהגדרות)
function envSummary(id) {
  const e = ENVS[id]; if (!e) return [];
  const out = [];
  out.push(e.quality === 'far' ? '🔭 זיהוי למרחקים (חד יותר, קצת יותר איטי)' : e.quality === 'fast' ? '⚡ זיהוי מהיר' : '🎯 זיהוי מאוזן');
  out.push(e.motionSens >= 7 ? '🫧 רגישות גבוהה לתנועות קטנות' : e.motionSens <= 4 ? '🌬️ רגישות נמוכה לתנועה (פחות התראות שווא)' : '🚶 רגישות רגילה לתנועה');
  if (e.stillMult < 1) out.push('⏱️ "לא זז" מתריע מהר יותר'); if (e.stillMult > 1) out.push('⏱️ "לא זז" סבלני יותר');
  out.push(e.fallLying ? '🧍 שכיבה מחוץ למיטה ולספה נבדקת כנפילה' : '🛌 שכיבה לא נחשבת נפילה');
  if (e.sleepOn) out.push('🌙 בשעות השינה (23:00–06:00) אין בדיקת "לא זז"');
  const snds = [e.cry && 'בכי', e.scream && 'צעקה', e.loud && 'רעש חזק', e.smoke && 'אזעקת עשן', e.glass && 'שבירת זכוכית'].filter(Boolean);
  out.push(`🎙️ ${e.mic ? 'המיקרופון מופעל. ' : ''}קולות שמזוהים: ${snds.join(', ')}`);
  if (e.soothe) out.push('🎵 הרגעה אוטומטית (שיר ערש) כשיש בכי');
  if (e.privacy) out.push('🙈 פרטיות: רק שלד על המסך, בלי תמונות ובלי קטעי וידאו');
  else out.push(e.emotions ? '🙂 חיישן רגשות פעיל' : '😶 חיישן רגשות כבוי');
  return out;
}
