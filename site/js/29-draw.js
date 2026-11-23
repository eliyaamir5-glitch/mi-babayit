/* ---------------- drawing ---------------- */
function drawLoop() {
  if (!running) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawZones();
  const now = Date.now();
  for (const t of tracks) {
    for (let i = 0; i < 4; i++) t.draw[i] += (t.box[i] - t.draw[i]) * 0.35; // החלקה
    const [x, y, w, h] = t.draw;
    const p = t.pid && byId(t.pid);
    const color = p ? (p.name ? '#22e3a1' : '#ffb547') : t.maybe ? '#9aa1b2' : '#7c8bff';
    const fade = Math.max(0, 1 - Math.max(0, now - t.seen - 300) / (CFG.trackTTL - 300));
    ctx.globalAlpha = fade;
    // פינות מעוגלות במקום מלבן
    const L = Math.min(w, h) * 0.22, r = 10;
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(3, w / 60); ctx.lineCap = 'round';
    ctx.shadowColor = color; ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(x, y + L); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.lineTo(x + L, y);
    ctx.moveTo(x + w - L, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + L);
    ctx.moveTo(x + w, y + h - L); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + w - L, y + h);
    ctx.moveTo(x + L, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + h - L);
    ctx.stroke(); ctx.shadowBlur = 0;
    // תווית
    const mp = !p && t.maybe && byId(t.maybe);
    const label = p ? nameOf(p) : mp ? `אולי ${nameOf(mp)}?` : 'מזהה...';
    const gp = p && p.guard && p.guard.on && S.settings.guardOn && G[p.id];
    const emo = p && p.name ? emoLabel(p.id) : '';
    const sub = (gp ? `${STATE_NAMES[gp.state]}${gp.resting ? ' · 😴 נח' : gp.cur && gp.cur.post ? ' · ' + POSTURE_NAMES[gp.cur.post] : ''} · ללא תנועה ${fmtDur(now - gp.lastMotion)}` : p ? `${Math.round(Math.min(1, t.sim) * 100)}% התאמה` : '') + (emo ? ' · ' + emo : '');
    const fs = Math.max(16, Math.min(30, w / 7));
    ctx.save();
    const mir = S.settings.mirror;
    ctx.font = `700 ${fs}px Heebo, Arial`;
    const tw = Math.max(ctx.measureText(label).width, sub ? ctx.measureText(sub).width * 0.6 : 0) + fs * 1.1;
    const bh = sub ? fs * 2.15 : fs * 1.5;
    const cx = x + w / 2, by = y + h + 10;
    if (mir) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
    ctx.fillStyle = 'rgba(8,10,16,.82)';
    roundRect(cx - tw / 2, by, tw, bh, bh / 2.4); ctx.fill();
    ctx.fillStyle = color; ctx.fillRect(cx - tw / 2 + bh / 2.4, by, tw - bh / 1.2, 2.5);
    ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillStyle = '#fff';
    ctx.fillText(label, cx, by + fs * 1.12);
    if (sub) { ctx.font = `500 ${fs * 0.58}px Heebo, Arial`; ctx.fillStyle = gp && gp.state !== 'ok' ? (gp.state === 'emergency' ? '#ff8fa3' : '#ffd08a') : 'rgba(255,255,255,.65)'; ctx.fillText(sub, cx, by + fs * 1.8); }
    if (gp) drawGuardBar(p, gp, cx - tw / 2, by + bh + 4, tw, now);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  if (guardActive()) drawBodies(now);
  drawPets(now);
  $('fps').textContent = fpsT.length;
  requestAnimationFrame(drawLoop);
}
function drawGuardBar(p, gp, x, y, w, now) {
  const R = effRules(p); if (!R.still.on) return;
  const pct = Math.min(1, (now - gp.lastMotion) / (R.still.val * 1000));
  ctx.fillStyle = 'rgba(8,10,16,.8)'; roundRect(x, y, w, 7, 3.5); ctx.fill();
  ctx.fillStyle = pct < 0.6 ? '#22e3a1' : pct < 0.85 ? '#ffb547' : '#ff5470';
  ctx.save(); ctx.translate(x + w, 0); ctx.scale(-1, 1); roundRect(0, y, Math.max(7, w * pct), 7, 3.5); ctx.fill(); ctx.restore();
}
const BONES = [['leftShoulder', 'rightShoulder'], ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'], ['leftHip', 'rightHip'], ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle']];
function drawBodies(now) {
  for (const b of bodies) {
    const p = b.pid && byId(b.pid); const gp = p && G[p.id];
    const col = gp ? (gp.state === 'emergency' ? '#ff5470' : gp.state === 'asking' ? '#ffb547' : '#00d4ff') : 'rgba(255,255,255,.35)';
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, canvas.width / 400); ctx.lineCap = 'round'; ctx.globalAlpha = 0.75;
    ctx.beginPath();
    for (const [a, c] of BONES) { const A = KP(b, a), C = KP(b, c); if (A && C) { ctx.moveTo(A[0], A[1]); ctx.lineTo(C[0], C[1]); } }
    ctx.stroke();
    ctx.fillStyle = col; for (const k in b.kp) if (b.kp[k][2] > 0.3) { ctx.beginPath(); ctx.arc(b.kp[k][0], b.kp[k][1], ctx.lineWidth * 1.4, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // אדם בשמירה שהפנים שלו לא נראות — תווית לפי הגוף
    if (p && !tracks.some((t) => t.pid === p.id && now - t.seen < 600)) {
      const h = headPoint(b) || [b.box[0] + b.box[2] / 2, b.box[1]];
      const fs = Math.max(16, canvas.width / 50), label = `${p.name} · ${gp ? STATE_NAMES[gp.state] : ''}`;
      ctx.save(); if (S.settings.mirror) { ctx.translate(h[0], 0); ctx.scale(-1, 1); ctx.translate(-h[0], 0); }
      ctx.font = `700 ${fs}px Heebo, Arial`; const tw = ctx.measureText(label).width + fs;
      ctx.fillStyle = 'rgba(8,10,16,.82)'; roundRect(h[0] - tw / 2, h[1] - fs * 2.6, tw, fs * 1.6, fs * 0.6); ctx.fill();
      ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.direction = 'rtl'; ctx.fillText(label, h[0], h[1] - fs * 1.4);
      ctx.restore();
    }
  }
}
function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

