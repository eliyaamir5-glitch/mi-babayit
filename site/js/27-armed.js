/* =========================================================
   מצב "בית ריק": כל אדם שמזוהה כשאין אף אחד בבית — התראה
   ========================================================= */
const ARM = { last: 0, sirenT: 0 };
function armedCheck(now) {
  if (!S.settings.armed || !running) return;
  const live = tracks.filter((t) => now - t.seen < 800);
  for (const t of live) {
    const p = t.pid && byId(t.pid);
    if (p && p.name && S.settings.armAuto !== false && (isAdult(p) || (p.role && groupOf(p.role) === 'home'))) {
      S.settings.armed = false; save(); syncSettings(); renderGuard(); logSafety(p, 'stop', `מצב בית ריק כובה — ${p.name} חזר הביתה`);
      toast(p, `🔓 ${p.name} בבית`, 'מצב בית ריק כובה אוטומטית'); sendAlerts(p, 'info', `מצב בית ריק כובה: ${p.name} זוהה בבית`); syncSend({ type: 'disarm', name: p.name }); return;
    }
  }
  const strangers = live.filter((t) => { const p = t.pid && byId(t.pid); return !(p && p.name) && now - t.born > 1500; }).length + bodies.filter((b) => !b.pid).length;
  if (strangers && now - ARM.last > 60000) {
    ARM.last = now; const snap = snapDataURL();
    logSafety(null, 'emergency', 'מצב בית ריק: זוהה אדם', snap); notifyEvent(null, 'intruder', 'זוהה אדם בבית כשמצב "בית ריק" פעיל');
    sendAlerts(null, 'intruder', 'זוהה אדם בבית כשמצב "בית ריק" פעיל'); syncSend({ type: 'intruder' });
    if (S.settings.armSiren) { sirenStart(); clearTimeout(ARM.sirenT); ARM.sirenT = setTimeout(() => { if (!Object.keys(G).some((k) => G[k].state === 'emergency')) sirenStop(); }, 30000); }
  }
}

