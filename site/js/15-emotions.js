/* =========================================================
   חיישן רגשות — מגמה לאורך כמה שניות, לא פריים בודד
   ========================================================= */
const EMO_NAMES = { neutral: 'רגוע', happy: 'שמח', sad: 'עצוב', angry: 'כועס', fear: 'מפוחד', surprise: 'מופתע', disgust: 'נגעל' };
const EMO_ICON = { neutral: '😐', happy: '😊', sad: '😢', angry: '😠', fear: '😨', surprise: '😮', disgust: '🤢' };
const EMO = {};
function updateEmotion(p, face, now) {
  if (!S.settings.emotions || !face || !face.emotion || !face.emotion.length) return;
  const s = EMO[p.id] || (EMO[p.id] = { emo: {} });
  const cur = {}; face.emotion.forEach((e) => (cur[e.emotion] = e.score));
  for (const k in EMO_NAMES) s.emo[k] = (s.emo[k] || 0) * 0.85 + (cur[k] || 0) * 0.15; // ממוצע נע
  let top = 'neutral', tv = 0; for (const k in s.emo) if (s.emo[k] > tv) { tv = s.emo[k]; top = k; }
  s.emoTop = top; s.emoConf = tv; s.emoAt = now;
  const bad = ['fear', 'sad', 'angry'].includes(top) && tv > 0.5;
  if (bad) { if (!s.distressSince) s.distressSince = now; } else s.distressSince = 0;
  if (!(p.guard && p.guard.on && S.settings.guardOn) || p.guard.pausedUntil > now) return;
  const R = effRules(p), g = gs(p.id);
  if (R.distress && R.distress.on && g.state === 'ok' && s.distressSince && now - s.distressSince > R.distress.val * 1000) {
    s.distressSince = 0; trigger(p, 'distress', `${EMO_NAMES[top]} במשך ${fmtSec(R.distress.val)}`);
  }
}
const emoLabel = (pid) => { const s = EMO[pid]; return s && s.emoTop && Date.now() - s.emoAt < 4000 ? `${EMO_ICON[s.emoTop]} ${EMO_NAMES[s.emoTop]}` : ''; };

