/* =========================================================
   שליטה מרחוק דרך ntfy: "אני מטפל", "בטל", "מצב", "תמונה", "אמור ..."
   ========================================================= */
let cmdES = null, cmdTopic = '';
const cmdName = () => (S.settings.ntfyTopic ? S.settings.ntfyTopic + '-cmd' : '');
const ntfyBase = () => (S.settings.ntfyServer || 'https://ntfy.sh').replace(/\/$/, '');
function syncCmd() {
  const want = S.settings.ntfyOn && S.settings.remoteOn && cmdName() && running;
  if (want && cmdTopic !== cmdName()) {
    try { if (cmdES) cmdES.close(); } catch (e) {}
    cmdTopic = cmdName();
    try {
      cmdES = new EventSource(`${ntfyBase()}/${encodeURIComponent(cmdTopic)}/sse`);
      cmdES.onmessage = (e) => { try { const d = JSON.parse(e.data); if (d.event === 'message' && d.message) onRemote(d.message.trim()); } catch (err) {} };
    } catch (e) { cmdES = null; }
  } else if (!want && cmdES) { try { cmdES.close(); } catch (e) {} cmdES = null; cmdTopic = ''; }
}
function onRemote(txt) {
  const t = txt.replace(/^\/+/, '');
  const active = guarded().filter((p) => G[p.id] && (G[p.id].state === 'emergency' || G[p.id].state === 'asking'));
  const vm = t.match(/^(ok|alarm):(\w+)/i);
  if (vm) { const p = byId(vm[2]); if (p) { if (vm[1].toLowerCase() === 'ok') verifyOk(p, 'האחראי אישר מהטלפון'); else verifyAlarm(p, 'האחראי'); } return; }
  const pend = guarded().filter((p) => G[p.id] && G[p.id].state === 'verify');
  if (pend.length && /^(בסדר|זה בסדר|רגיל)/.test(t)) { pend.forEach((p) => verifyOk(p, 'האחראי אישר מהטלפון')); return; }
  if (pend.length && /^(חירום|אזעקה|זה חירום)/.test(t)) { pend.forEach((p) => verifyAlarm(p, 'האחראי')); return; }
  if (/^(ack|מטפל|אני מטפל)/i.test(t)) {
    active.forEach((p) => { const s = G[p.id]; s.acked = Date.now(); logSafety(p, 'resolved', 'בן משפחה מטפל (מרחוק)'); speak(`${p.name}, עזרה בדרך`, true); });
    toast(null, 'בן משפחה מטפל', 'התקבל אישור מרחוק'); sendAlerts(null, 'info', 'התקבל: מישהו מטפל. התזכורות נעצרו.'); renderGuard();
  } else if (/^(cancel|בטל)/i.test(t)) {
    active.forEach((p) => resolve(p, 'remote'));
  } else if (/^(status|מצב)/i.test(t)) {
    sendAlerts(null, 'status', statusText());
  } else if (/^(snap|תמונה)/i.test(t)) {
    sendAlerts(null, 'status', 'תמונה מהמצלמה עכשיו');
  } else if (/^(mute|השתק)/i.test(t)) {
    sirenMuted = true; sirenLevel(); renderEmergency();
  } else if (/^(summary|סיכום)/i.test(t)) {
    sendAlerts(null, 'summary', dailySummary().join('\n'));
  } else {
    const m = t.match(/^(say|אמור|תגיד)\s+(.+)/i);
    if (m) { speak(m[2], true); logSafety(null, 'notify', `הודעה מרחוק הוקראה: ${m[2]}`); toast(null, '📢 הודעה מרחוק', m[2]); }
  }
}
HOW.remote = 'בוטל מרחוק';
function statusText() {
  const list = guarded();
  const parts = list.map((p) => { const s = G[p.id]; return `${p.name}: ${s ? STATE_NAMES[s.state] : 'ממתין'}${s && s.lastSeen ? `, נראה ${ago(s.lastSeen)}` : ''}${s ? `, תנועה אחרונה לפני ${fmtDur(Date.now() - s.lastMotion)}` : ''}`; });
  return [`מצלמה: ${running ? 'פועלת' : 'כבויה'} · שמירה: ${S.settings.guardOn ? 'פעילה' : 'כבויה'}`, ...parts, devLine()].join('\n');
}

