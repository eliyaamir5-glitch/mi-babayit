/* =========================================================
   מצב המכשיר: סוללה ואינטרנט
   ========================================================= */
const DEV = { battery: null, charging: true, online: navigator.onLine, warnedBat: 0 };
(async () => {
  try {
    const b = await navigator.getBattery();
    const upd = () => { DEV.battery = b.level; DEV.charging = b.charging; checkDevice(); };
    b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd); upd();
  } catch (e) {}
})();
window.addEventListener('online', () => { DEV.online = true; renderGuard(); if (guardActive()) toast(null, 'החיבור לאינטרנט חזר', 'ההתראות לטלפון פעילות שוב'); });
window.addEventListener('offline', () => { DEV.online = false; logSafety(null, 'device', 'אין חיבור לאינטרנט — התראות לטלפון לא יישלחו'); renderGuard(); if (guardActive()) toast(null, 'אין חיבור לאינטרנט', 'הזיהוי ממשיך, אבל התראות לטלפון לא יישלחו'); });
function checkDevice() {
  if (!guardActive() || DEV.battery == null) return;
  if (!DEV.charging && DEV.battery < 0.2 && Date.now() - DEV.warnedBat > 30 * 60000) {
    DEV.warnedBat = Date.now();
    logSafety(null, 'device', `סוללה חלשה (${Math.round(DEV.battery * 100)}%) ולא בטעינה`);
    toast(null, 'סוללה חלשה', 'חבר את מכשיר השמירה לחשמל'); sendAlerts(null, 'notify', `סוללה חלשה במכשיר השמירה (${Math.round(DEV.battery * 100)}%)`);
  }
}
setInterval(checkDevice, 60000); // הועבר מקובץ ממשק השמירה: חייב לבוא אחרי הגדרת checkDevice
const devLine = () => {
  const parts = [];
  if (DEV.battery != null) parts.push(`🔋 ${Math.round(DEV.battery * 100)}%${DEV.charging ? ' בטעינה' : ''}`);
  parts.push(DEV.online ? '🌐 מחובר' : '⚠️ אין אינטרנט');
  parts.push(S.settings.snd.on ? (A.on ? `🎙️ מאזין · רעש ${Math.max(0, Math.round(A.meter))} דציבל` : '🎙️ ממתין') : '🔇 שמע כבוי');
  const e = envCfg(); parts.push(`${e.icon} ${e.name}${e.privacy ? ' · פרטיות' : ''}`);
  return parts.join(' · ');
};

