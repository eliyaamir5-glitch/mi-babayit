/* =========================================================
   דופק: כתובת שמקבלת "אני חי" כל 5 דקות (למשל healthchecks.io)
   ========================================================= */
setInterval(() => {
  if (!S.settings.heartbeat || !running) return;
  try { fetch(S.settings.heartbeat, { method: 'GET', mode: 'no-cors', cache: 'no-store' }).catch(() => {}); } catch (e) {}
}, 5 * 60000);

/* =========================================================
   בדיקת מערכת
   ========================================================= */
async function selfTest() {
  const R = [];
  const add = (ok, name, tip) => R.push({ ok, name, tip });
  add(!!human && !!engineName, 'מנוע זיהוי', engineName ? `פועל (${engineName})` : 'לא נטען — בדוק חיבור לאינטרנט ורענן');
  add(running, 'מצלמה', running ? `${video.videoWidth}x${video.videoHeight}` : 'לחץ "הפעל מצלמה"');
  add(!S.settings.snd.on || A.on, 'מיקרופון', S.settings.snd.on ? (A.on ? 'מאזין' : 'אין הרשאה או שהמצלמה כבויה') : 'חיישני שמע כבויים (לא חובה)');
  const v = hebVoice(); add(!!v, 'קול עברי', v ? v.name : 'אין קול עברי — השאלות עלולות להישמע לא ברור');
  add(!!(window.SpeechRecognition || window.webkitSpeechRecognition), 'זיהוי דיבור', 'למענה "כן" / "בסדר"');
  add(DEV.online, 'אינטרנט', DEV.online ? 'מחובר' : 'אין חיבור — התראות לטלפון לא יישלחו');
  add(DEV.battery == null || DEV.charging || DEV.battery > 0.3, 'סוללה', DEV.battery == null ? 'לא ידוע' : `${Math.round(DEV.battery * 100)}%${DEV.charging ? ' בטעינה' : ' — מומלץ לחבר לחשמל'}`);
  add(!!navigator.wakeLock, 'מסך דלוק', navigator.wakeLock ? 'נתמך' : 'הדפדפן לא תומך — כבה נעילת מסך אוטומטית בהגדרות הטלפון');
  add(S.settings.ntfyOn || S.settings.webhook || S.settings.notifOn, 'ערוץ התראות', S.settings.ntfyOn ? `ntfy: ${S.settings.ntfyTopic}` : 'לא הוגדר ערוץ — הגדר ntfy בהגדרות');
  add(guarded().length > 0, 'אנשים בשמירה', guarded().length ? guarded().map((p) => p.name).join(', ') : 'הפעל "שמירה פעילה" בפרופיל');
  let persisted = false; try { persisted = navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch (e) {}
  add(persisted, 'שמירת נתונים קבועה', persisted ? 'הדפדפן לא ימחק את הנתונים' : 'הדפדפן עלול למחוק נתונים כשהזיכרון מתמלא — הוסף למסך הבית ושמור גיבוי');
  $('stList').innerHTML = R.map((r) => `<div class="strow ${r.ok ? 'ok' : 'bad'}"><span>${r.ok ? '✓' : '!'}</span><div><b>${r.name}</b><small>${esc(r.tip)}</small></div></div>`).join('');
  $('stModal').classList.add('open');
  if (S.settings.ntfyOn || S.settings.webhook || S.settings.notifOn) sendAlerts(null, 'test');
}

