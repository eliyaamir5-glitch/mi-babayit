/* =========================================================
   חיות מחמד
   ========================================================= */
const PET_KINDS = { dog: { name: 'כלב', icon: '🐕' }, cat: { name: 'חתול', icon: '🐈' } };
S.pets = S.pets || [];
const PET = { obs: [], last: 0, objOK: true };
async function petPass(now) {
  const need = (S.settings.pets && S.settings.pets.on) || S.settings.armed;
  if (!need || now - PET.last < 3000 || !PET.objOK) return;
  PET.last = now;
  try {
    const W = video.videoWidth, H = video.videoHeight, cw = Math.min(640, W);
    const m = grab(CV.full, 0, 0, W, H, cw, H * cw / W);
    const r = await human.detect(CV.full, { face: { enabled: false }, body: { enabled: false }, object: { enabled: true, modelPath: 'centernet.json', minConfidence: 0.38, maxDetected: 6, skipFrames: 0, skipTime: 0 } });
    const found = (r.object || []).filter((o) => o.label === 'dog' || o.label === 'cat').map((o) => ({ kind: o.label, score: o.score, box: [m.sx + o.box[0] * m.kx, m.sy + o.box[1] * m.ky, o.box[2] * m.kx, o.box[3] * m.ky], t: now }));
    PET.obs = found.concat(PET.obs.filter((o) => now - o.t < 2500 && !found.some((f) => iou(f.box, o.box) > 0.3)));
    for (const o of found) {
      const same = S.pets.filter((p) => p.kind === o.kind);
      o.pet = same.length === 1 ? same[0] : null;
      if (o.pet) { if (now - (o.pet.lastSeen || 0) > 10 * 60000) logSafety(null, 'zone', `${PET_KINDS[o.kind].icon} ${o.pet.name} נראה`); o.pet.lastSeen = now; if (!o.pet.thumb) o.pet.thumb = crop(o.box, 120); }
      if (!S.pets.length && now - (PET.hint || 0) > 3600e3) { PET.hint = now; toast(null, `${PET_KINDS[o.kind].icon} זוהה ${PET_KINDS[o.kind].name}`, 'אפשר לתת לו שם בהגדרות › חיות מחמד'); }
    }
  } catch (e) { console.warn('pets', e); PET.objOK = false; toast(null, 'זיהוי חיות לא זמין', 'המודל לא נטען במכשיר הזה'); }
}
function drawPets(now) {
  for (const o of PET.obs) {
    if (now - o.t > 2500) continue;
    const [x, y, w, h] = o.box, k = PET_KINDS[o.kind];
    ctx.save(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(2, w / 70); ctx.setLineDash([4, 6]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    const lab = `${k.icon} ${o.pet ? o.pet.name : k.name}`, fs = Math.max(15, Math.min(26, w / 6)), cx = x + w / 2;
    if (S.settings.mirror) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.font = `700 ${fs}px Heebo, Arial`; ctx.textAlign = 'center'; ctx.direction = 'rtl'; const tw = ctx.measureText(lab).width + fs;
    ctx.fillStyle = 'rgba(8,10,16,.82)'; roundRect(cx - tw / 2, y - fs * 1.7, tw, fs * 1.5, fs * 0.5); ctx.fill(); ctx.fillStyle = '#ffd166'; ctx.fillText(lab, cx, y - fs * 0.55); ctx.restore();
  }
}
setInterval(() => {
  const ps = S.settings.pets; if (!ps || !ps.on || !ps.missH || !running) return;
  for (const p of S.pets) {
    const since = Date.now() - (p.lastSeen || p.added || Date.now());
    if (since > ps.missH * 3600e3 && Date.now() - (p.warned || 0) > 12 * 3600e3) { p.warned = Date.now(); save(); notifyEvent(null, 'petmiss', `${PET_KINDS[p.kind].icon} ${p.name} לא נראה ${fmtSec(since / 1000)}`); }
  }
}, 5 * 60000);
function renderPets() {
  $('petList').innerHTML = S.pets.length ? S.pets.map((p) => `<div class="schedrow"><span class="si">${PET_KINDS[p.kind].icon}</span><b>${esc(p.name)}</b><span class="hint2" style="margin:0">${p.lastSeen ? 'נראה ' + ago(p.lastSeen) : 'עוד לא נראה'}</span><button class="sx" data-petdel="${p.id}" aria-label="מחק את ${esc(p.name)}">✕</button></div>`).join('') : '<div class="hint2" style="margin:0">אין עדיין חיות מחמד.</div>';
}
document.addEventListener('click', (e) => { const d = e.target.closest('[data-petdel]'); if (d) { S.pets = S.pets.filter((p) => p.id !== d.dataset.petdel); save(); renderPets(); } });

