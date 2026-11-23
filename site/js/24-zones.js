/* =========================================================
   אזורים: דלת, חלון, נקודת כניסה, אזור אסור, מיטה, ספה
   ========================================================= */
const ZONE_TYPES = {
  door: { name: 'דלת', icon: '🚪', color: '#00d4ff' }, window: { name: 'חלון', icon: '🪟', color: '#7c9cff' },
  entry: { name: 'נקודת כניסה', icon: '➡️', color: '#22e3a1' }, danger: { name: 'אזור אסור', icon: '⛔', color: '#ff5470' },
  bed: { name: 'מיטה', icon: '🛏️', color: '#c39bff' }, couch: { name: 'ספה', icon: '🛋️', color: '#ffb547' }, other: { name: 'אחר', icon: '📍', color: '#9aa2b5' },
};
const isEntryZone = (z) => ['door', 'window', 'entry'].includes(z.type);
S.zones = S.zones || [];
const ZE = { on: false, a: null, b: null, pending: null, type: 'door' };
const ZST = {}; // מצב "בתוך אזור" לכל אדם/חיה ואזור
function zoneEdit(on) {
  ZE.on = on; ZE.a = ZE.b = null;
  $('stage').classList.toggle('zedit', on); $('zHint').classList.toggle('hidden', !on);
  $('zoneBtn').textContent = on ? '✓ סיום סימון' : '📍 דלתות ואזורים';
  renderZoneList();
}
function renderZoneList() {
  $('zList').innerHTML = S.zones.length ? S.zones.map((z) => `<span class="zchip" style="--zc:${ZONE_TYPES[z.type].color}">${ZONE_TYPES[z.type].icon} ${esc(z.name)}<button data-zdel="${z.id}" aria-label="מחק אזור ${esc(z.name)}">✕</button></span>`).join('') : '<span class="hint2" style="margin:0">עוד אין אזורים</span>';
}
function vpt(e) { const [x, y] = canvasPoint(e); return [Math.max(0, Math.min(1, x / canvas.width)), Math.max(0, Math.min(1, y / canvas.height))]; }
canvas.addEventListener('pointerdown', (e) => { if (!ZE.on) return; e.preventDefault(); canvas.setPointerCapture(e.pointerId); ZE.a = vpt(e); ZE.b = ZE.a; });
canvas.addEventListener('pointermove', (e) => { if (ZE.on && ZE.a) { e.preventDefault(); ZE.b = vpt(e); } });
canvas.addEventListener('pointerup', (e) => {
  if (!ZE.on || !ZE.a) return;
  const [x1, y1] = ZE.a, [x2, y2] = ZE.b || ZE.a;
  ZE.a = null;
  if (Math.abs(x2 - x1) < 0.03 || Math.abs(y2 - y1) < 0.03) { ZE.b = null; return; }
  ZE.pending = { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
  $('zName').value = ''; renderZTypes(); $('zoneModal').classList.add('open');
});
function renderZTypes() { $('zTypes').innerHTML = Object.entries(ZONE_TYPES).map(([k, t]) => `<button data-zt="${k}" class="${ZE.type === k ? 'on' : ''}">${t.icon} ${t.name}</button>`).join(''); }
$('zTypes').onclick = (e) => { const b = e.target.closest('[data-zt]'); if (b) { ZE.type = b.dataset.zt; renderZTypes(); } };
$('zSave').onclick = () => {
  if (!ZE.pending) return;
  const name = $('zName').value.trim() || ZONE_TYPES[ZE.type].name + (S.zones.filter((z) => z.type === ZE.type).length ? ' ' + (S.zones.filter((z) => z.type === ZE.type).length + 1) : '');
  S.zones.push(Object.assign({ id: 'z' + Date.now().toString(36), name, type: ZE.type }, ZE.pending));
  ZE.pending = null; ZE.b = null; save(); $('zoneModal').classList.remove('open'); renderZoneList(); toast(null, `${ZONE_TYPES[ZE.type].icon} נשמר: ${name}`, 'אפשר לסמן עוד אזור או ללחוץ "סיום"');
};
function zoneFormCancel() { ZE.pending = null; ZE.b = null; $('zoneModal').classList.remove('open'); }
$('zCancel').onclick = zoneFormCancel;
document.addEventListener('click', (e) => { const d = e.target.closest('[data-zdel]'); if (d) { const z = S.zones.find((x) => x.id === d.dataset.zdel); confirmBox(`למחוק את האזור "${z ? z.name : ''}"?`, () => { S.zones = S.zones.filter((x) => x.id !== d.dataset.zdel); save(); renderZoneList(); }); } });
function inZone(z, px, py) { const W = canvas.width, H = canvas.height; return px >= z.x * W && px <= (z.x + z.w) * W && py >= z.y * H && py <= (z.y + z.h) * H; }
function drawZones() {
  if (!S.zones.length && !ZE.on) return;
  if (!ZE.on && !S.settings.showZones) return;
  const W = canvas.width, H = canvas.height;
  ctx.save(); ctx.lineWidth = Math.max(2, W / 450); ctx.setLineDash([10, 7]);
  for (const z of S.zones) {
    const t = ZONE_TYPES[z.type]; ctx.strokeStyle = t.color; ctx.fillStyle = t.color + '22';
    ctx.fillRect(z.x * W, z.y * H, z.w * W, z.h * H); ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);
    const fs = Math.max(14, W / 60), lx = (z.x + z.w / 2) * W, ly = z.y * H + fs * 1.3;
    ctx.save(); if (S.settings.mirror) { ctx.translate(lx, 0); ctx.scale(-1, 1); ctx.translate(-lx, 0); }
    ctx.setLineDash([]); ctx.font = `700 ${fs}px Heebo, Arial`; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    const lab = `${t.icon} ${z.name}`, tw = ctx.measureText(lab).width + fs;
    ctx.fillStyle = 'rgba(8,10,16,.8)'; roundRect(lx - tw / 2, ly - fs * 1.1, tw, fs * 1.5, fs * 0.5); ctx.fill();
    ctx.fillStyle = t.color; ctx.fillText(lab, lx, ly); ctx.restore();
  }
  if (ZE.on && ZE.a && ZE.b) { ctx.strokeStyle = '#fff'; ctx.setLineDash([6, 6]); const [x1, y1] = ZE.a, [x2, y2] = ZE.b; ctx.strokeRect(Math.min(x1, x2) * W, Math.min(y1, y2) * H, Math.abs(x2 - x1) * W, Math.abs(y2 - y1) * H); }
  ctx.restore();
}
// מעקב כניסה לאזורים — לכל אדם מזוהה, אדם לא מוכר וחיית מחמד
function zoneTick(now) {
  if (!S.zones.length) return;
  const subs = [];
  for (const t of tracks) { if (now - t.seen > 600) continue; const p = t.pid && byId(t.pid); subs.push({ key: 't' + (p ? p.id : 'u' + t.id), p, kind: 'person', x: t.box[0] + t.box[2] / 2, y: t.box[1] + t.box[3] / 2 }); }
  for (const b of bodies) { if ((b.ft && now - b.ft.seen < 600) || tracks.some((t) => t.pid && t.pid === b.pid && now - t.seen < 600)) continue; const c = torso(b); const pt = c ? c.sh : [b.box[0] + b.box[2] / 2, b.box[1] + b.box[3] / 3]; const p = b.pid && byId(b.pid); subs.push({ key: 'b' + (p ? p.id : Math.round(b.box[0] / 50)), p, kind: 'person', x: pt[0], y: pt[1] }); }
  for (const o of PET.obs) { if (now - o.t > 2500) continue; subs.push({ key: 'pet' + (o.pet ? o.pet.id : o.kind), pet: o.pet, petKind: o.kind, kind: 'pet', x: o.box[0] + o.box[2] / 2, y: o.box[1] + o.box[3] / 2 }); }
  for (const s of subs) for (const z of S.zones) {
    const k = s.key + ':' + z.id, st = ZST[k] || (ZST[k] = { n: 0, in: false, t: 0 });
    const inside = inZone(z, s.x, s.y);
    st.n = inside ? Math.min(st.n + 1, 5) : Math.max(st.n - 1, 0); st.seen = now;
    if (!st.in && st.n >= 2) { st.in = true; st.t = now; zoneEnter(s, z, now); }
    else if (st.in && st.n === 0) st.in = false;
  }
  for (const k in ZST) if (now - ZST[k].seen > 60000) delete ZST[k];
}
function zoneEnter(s, z, now) {
  const who = s.kind === 'pet' ? (s.pet ? s.pet.name : PET_KINDS[s.petKind].name) : s.p ? nameOf(s.p) : 'אדם לא מזוהה';
  if (isEntryZone(z) && s.kind === 'person') {
    if (now - (z.lastLog || 0) > 20000) { z.lastLog = now; logSafety(s.p || null, 'zone', `${who} ליד ${z.name}`, snapDataURL(360)); }
    if (s.p && s.p.name) arrivalSeen(s.p.id, z.name, null);
    else arrivalSeen(null, z.name, null);
    syncSend({ type: 'zone', name: s.p && s.p.name ? s.p.name : null, zone: z.name, ztype: z.type });
  }
  if (z.type === 'danger') {
    const kid = s.p && s.p.name && isKid(s.p), pet = s.kind === 'pet';
    if ((kid || pet || S.settings.dangerAll) && now - (z.lastAlert || 0) > 3 * 60000) {
      z.lastAlert = now; logSafety(s.p || null, 'notify', `${who} נכנס ל${z.name}`, snapDataURL());
      notifyEvent(s.p || null, 'danger', `${who} נכנס לאזור האסור "${z.name}"`);
      if (S.settings.dangerSpeak !== false) speak(pet ? `${who}, לא שם!` : `${who}, זה מקום מסוכן, בבקשה לצאת`, false);
    }
  }
}
Object.assign(REASON_NAMES, { danger: 'אזור אסור', arrive: 'הגעה', late: 'לא הגיע בזמן', intruder: 'זוהה אדם בבית ריק', bark: 'נביחות', petmiss: 'חיית מחמד לא נראתה' });

