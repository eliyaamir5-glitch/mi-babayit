/* ---------------- helpers ---------------- */
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nameOf = (p) => p.name || p.label;
const byId = (id) => S.people.find((p) => p.id === id);
function norm(a) { let n = 0; for (let i = 0; i < a.length; i++) n += a[i] * a[i]; n = Math.sqrt(n) || 1; const o = new Float32Array(a.length); for (let i = 0; i < a.length; i++) o[i] = a[i] / n; return o; }
function sim(a, b) { let d = 0; for (let i = 0; i < a.length; i++) d += a[i] * b[i]; return d; } // וקטורים מנורמלים = קוסינוס
// ציון לאדם: ממוצע שלוש ההתאמות הטובות — עמיד יותר מהתאמה בודדת מקרית
function scorePerson(emb, p) {
  const v = p.samples.map((x) => sim(emb, x.e)).sort((a, b) => b - a);
  const k = Math.min(3, v.length); if (!k) return 0;
  let m = 0; for (let i = 0; i < k; i++) m += v[i]; return m / k;
}
function bestPerson(emb, blocked) {
  let best = null, bestSim = 0, second = 0;
  for (const p of S.people) {
    if (blocked && blocked.has(p.id)) continue;
    const m = scorePerson(emb, p);
    if (m > bestSim) { second = bestSim; bestSim = m; best = p; } else if (m > second) second = m;
  }
  return { person: best, sim: bestSim, second };
}
function thumbSmall(box) { return crop(box, 72, 0.6); }
function iou(a, b) {
  const x1 = Math.max(a[0], b[0]), y1 = Math.max(a[1], b[1]);
  const x2 = Math.min(a[0] + a[2], b[0] + b[2]), y2 = Math.min(a[1] + a[3], b[1] + b[3]);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return inter / (a[2] * a[3] + b[2] * b[3] - inter || 1);
}
function quality(f) {
  const [, , w, h] = f.box;
  const a = f.rotation && f.rotation.angle;
  const frontal = !a || (Math.abs(a.yaw) < CFG.maxYaw && Math.abs(a.pitch) < CFG.maxPitch);
  const ok = Math.min(w, h) >= CFG.minEnrollPx && frontal && (f.score || 0) >= CFG.minScore && f.embedding && f.embedding.length;
  // ציון איכות לבחירת התמונה הכי טובה
  const q = (f.score || 0) * Math.min(1, Math.min(w, h) / 220) * (a ? (1 - Math.abs(a.yaw)) * (1 - Math.abs(a.pitch)) : 1);
  return { ok, q };
}
function crop(box, size = 200, qlt = 0.82) {
  const c = document.createElement('canvas'); c.width = size; c.height = size;
  const g = c.getContext('2d');
  const [x, y, w, h] = box; const side = Math.max(w, h) * 1.5;
  const cx = x + w / 2, cy = y + h / 2 - h * 0.05;
  if (S.settings.mirror) { g.translate(size, 0); g.scale(-1, 1); }
  g.drawImage(video, cx - side / 2, cy - side / 2, side, side, 0, 0, size, size);
  return c.toDataURL('image/jpeg', qlt);
}
function ago(t) {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 8) return 'עכשיו';
  if (s < 60) return `לפני ${s} שניות`;
  const m = Math.round(s / 60); if (m < 60) return m === 1 ? 'לפני דקה' : `לפני ${m} דקות`;
  const h = Math.round(m / 60); if (h < 24) return h === 1 ? 'לפני שעה' : `לפני ${h} שעות`;
  const d = Math.round(h / 24); return d === 1 ? 'אתמול' : `לפני ${d} ימים`;
}
const hhmm = (t) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
function dayLabel(t) {
  const d = new Date(t), now = new Date();
  const diff = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (diff === 0) return 'היום'; if (diff === 1) return 'אתמול';
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' });
}
function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

