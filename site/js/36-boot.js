/* ---------------- boot ---------------- */
(async () => {
  await DB.open();
  const saved = await DB.get('state-v3');
  if (saved && Array.isArray(saved.people)) S = Object.assign(S, saved, { settings: Object.assign(S.settings, saved.settings || {}) });
  S.safety = S.safety || [];
  normalizeState();
  if (!S.settings.v4) { S.settings.quality = 'balanced'; S.settings.v4 = true; }
  if (S.settings.quality === 'sharp') S.settings.quality = 'far';
  // גרסה 13: התוספות הניסיוניות (מראה, גוף חד, שלד) כבויות עד שמדליקים אותן במפורש
  if (!S.settings.v13) { S.settings.looks = false; S.settings.bodySharp = false; S.settings.bodyDraw = false; S.settings.v13 = true; }
  // גרסה 14: מנוע אמין (WebGL) כברירת מחדל, ושיפור בחושך כבוי — שניהם חשודים בזיהוי שגוי במחשב של הבעלים
  if (!S.settings.v14) { S.settings.engine = 'webgl'; S.settings.night = false; S.settings.v14 = true; }
  syncSettings(); render(); renderGuard(); applyA11y();
  setStatus('load', 'טוען מנוע זיהוי...');
  initEngine();
  if (!S.settings.onboarded) openOnboard(true);
})();
