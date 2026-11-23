/* =========================================================
   שיפור תמונה בחושך — כשהחדר חשוך, מבהירים את התמונה לפני הזיהוי (וגם על המסך)
   זו הבהרה דיגיטלית, לא ראיית לילה אמיתית: בחושך מוחלט אין מה להבהיר.
   ========================================================= */
const NIGHT = { gain: 1, mean: 128, at: 0, cv: document.createElement('canvas'), told: false };
NIGHT.cv.width = 16; NIGHT.cv.height = 9;
const nightOn = () => S.settings.night !== false;
// כמה להבהיר לפי הבהירות הממוצעת (0..255). מעל 70 — לא נוגעים
function nightGain(mean) { return mean >= 70 ? 1 : Math.min(2.4, Math.max(1, 95 / Math.max(20, mean))); }
function nightFilter() { return NIGHT.gain > 1.05 ? `brightness(${NIGHT.gain.toFixed(2)}) contrast(1.08)` : 'none'; }
function nightTick(now) {
  if (now - NIGHT.at < 3000) return; NIGHT.at = now;
  try {
    const g = NIGHT.cv.getContext('2d', { willReadFrequently: true }); g.drawImage(video, 0, 0, 16, 9);
    const d = g.getImageData(0, 0, 16, 9).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    NIGHT.mean = s / (d.length / 4);
  } catch (e) { return; }
  const want = nightOn() ? nightGain(NIGHT.mean) : 1;
  NIGHT.gain += (want - NIGHT.gain) * 0.5; // מעבר הדרגתי, בלי הבהובים
  video.style.filter = nightFilter() === 'none' ? '' : nightFilter();
  if (NIGHT.gain > 1.3 && !NIGHT.told) { NIGHT.told = true; toast(null, '🌙 חשוך כאן', 'מבהיר את התמונה כדי לזהות טוב יותר. אור קטן בחדר ישפר מאוד את הזיהוי'); }
}
