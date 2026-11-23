/* ---------------- boot ---------------- */
(async () => {
  await DB.open();
  const saved = await DB.get('state-v3');
  if (saved && Array.isArray(saved.people)) S = Object.assign(S, saved, { settings: Object.assign(S.settings, saved.settings || {}) });
  S.safety = S.safety || [];
  normalizeState();
  if (!S.settings.v4) { S.settings.quality = 'balanced'; S.settings.v4 = true; }
  if (S.settings.quality === 'sharp') S.settings.quality = 'far';
  syncSettings(); render(); renderGuard(); applyA11y();
  setStatus('load', 'טוען מנוע זיהוי...');
  initEngine();
})();
