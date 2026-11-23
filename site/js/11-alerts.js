/* ---------- התראות החוצה ---------- */
async function snapshotBlob() {
  if (envCfg().privacy) return null;
  const W = video.videoWidth, H = video.videoHeight; if (!W) return null;
  const sc = Math.min(1, 960 / W), c = document.createElement('canvas'); c.width = Math.round(W * sc); c.height = Math.round(H * sc);
  const g = c.getContext('2d'); if (S.settings.mirror) { g.translate(c.width, 0); g.scale(-1, 1); }
  g.drawImage(video, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8));
}
async function sendAlerts(p, kind, extra) {
  const s = p && G[p.id] ? G[p.id] : {}; const drill = (s.reason === 'drill' && kind !== 'notify') || kind === 'test';
  const pre = drill ? '[תרגול] ' : '';
  let title, msg;
  if (kind === 'test') { title = 'בדיקה: מי בבית'; msg = 'ההתראות עובדות. כך תיראה התראת חירום.'; }
  else if (kind === 'resolved') { title = `${pre}${p.name} בסדר`; msg = `החירום בוטל: ${extra || ''}`; }
  else if (kind === 'notify') { title = `התראה${p ? ' — ' + p.name : ''}`; msg = extra || ''; }
  else if (kind === 'verify') { title = `❓ ${extra === 'תזכורת' ? 'תזכורת: ' : ''}${p.name} · ${REASON_NAMES[s.reason] || ''}${S.settings.camName ? ' · ' + S.settings.camName : ''}`; msg = `${s.detail || ''}\nזה בסדר? אם זה מצב רגיל (למשל ישן או נח) — לחצו "זה בסדר" ולא אתריע שוב עד שיהיה שינוי. אם צריך עזרה — "זה חירום" יפעיל אזעקה בבית.`; }
  else if (kind === 'intruder') { title = `🚨 בית ריק: זוהה אדם${S.settings.camName ? ' · ' + S.settings.camName : ''}`; msg = extra || ''; }
  else if (kind === 'summary') { title = `סיכום יומי · ${new Date().toLocaleDateString('he-IL')}`; msg = extra || ''; }
  else if (kind === 'status' || kind === 'info') { title = kind === 'status' ? 'מצב הבית עכשיו' : 'מי בבית'; msg = extra || ''; }
  else {
    title = `${pre}${kind === 'remind' ? 'תזכורת: ' : ''}חירום — ${p.name}`;
    msg = `${REASON_NAMES[s.reason]}${s.detail ? ' · ' + s.detail : ''}\nתנועה אחרונה לפני ${fmtDur(Date.now() - s.lastMotion)}${p.emInstr ? '\nהוראות: ' + p.emInstr : ''}${p.emContact && p.emContact.phone ? `\nאיש קשר: ${p.emContact.name || ''} ${p.emContact.phone}` : ''}`;
  }
  const img = ['resolved', 'summary', 'info'].includes(kind) || (kind === 'verify' && extra === 'תזכורת') ? null : await snapshotBlob().catch(() => null);
  if (S.settings.ntfyOn && S.settings.ntfyTopic) {
    try {
      const q = new URLSearchParams({ title, priority: kind === 'resolved' || kind === 'test' ? '3' : kind === 'notify' ? '4' : '5', tags: kind === 'resolved' ? 'white_check_mark' : kind === 'notify' ? 'bell' : kind === 'summary' ? 'spiral_notepad' : kind === 'status' || kind === 'info' ? 'house' : 'rotating_light' });
      if (kind === 'summary' || kind === 'status' || kind === 'info') q.set('priority', '3');
      if (kind === 'intruder') q.set('priority', '5');
      if (kind === 'verify') { q.set('priority', '4'); q.set('tags', 'question'); const cu = `${ntfyBase()}/${encodeURIComponent(cmdName())}`; q.set('actions', `http, ✅ זה בסדר, ${cu}, method=POST, body=ok:${p.id}, clear=true; http, 🚨 זה חירום, ${cu}, method=POST, body=alarm:${p.id}, clear=true`); }
      if (S.settings.remoteOn && (kind === 'emergency' || kind === 'remind')) {
        const cu = `${ntfyBase()}/${encodeURIComponent(cmdName())}`;
        q.set('actions', `http, אני מטפל, ${cu}, method=POST, body=ack, clear=true; http, בטל חירום, ${cu}, method=POST, body=cancel, clear=true; http, השתק סירנה, ${cu}, method=POST, body=mute`);
      }
      let body = msg;
      if (img) { q.set('message', msg); q.set('filename', 'camera.jpg'); body = img; }
      await fetch(`${(S.settings.ntfyServer || 'https://ntfy.sh').replace(/\/$/, '')}/${encodeURIComponent(S.settings.ntfyTopic)}?${q}`, { method: img ? 'PUT' : 'POST', body });
      if (kind === 'test') toast(null, 'נשלחה התראת בדיקה', 'בדוק את אפליקציית ntfy בטלפון');
    } catch (e) { if (kind === 'test') toast(null, 'השליחה נכשלה', 'בדוק חיבור לאינטרנט ואת שם הערוץ'); }
  }
  if (S.settings.webhook) {
    const payload = { app: 'mi-babayit', kind, drill, name: p ? p.name : null, reason: s.reason || null, title, message: msg, time: new Date().toISOString() };
    try { await fetch(S.settings.webhook, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); } catch (e) {} // שליחה אחת בלבד
  }
  if (S.settings.notifOn && window.Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body: msg, icon: p && p.thumb, requireInteraction: kind !== 'resolved', tag: 'mibabayit-' + (p ? p.id : 'test') }); }
    catch (e) { if (!window.__notifWarned) { window.__notifWarned = 1; toast(null, 'התראות דפדפן לא נתמכות כאן', 'במכשיר הזה השתמש בהתראות ntfy'); } }
  }
}
function newTopic() { const a = 'abcdefghijkmnpqrstuvwxyz23456789'; let s = 'mibabayit-'; const r = new Uint32Array(12); crypto.getRandomValues(r); r.forEach((x) => (s += a[x % a.length])); return s; }

