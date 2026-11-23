/* =========================================================
   התקנה כאפליקציה (PWA): אייקון במסך הבית, מסך מלא, ופתיחה מהירה גם בלי רשת
   ========================================================= */
const PWA = { prompt: null };
const pwaStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
function renderInstall() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (pwaStandalone()) { $('instTxt').textContent = 'האפליקציה מותקנת ✓'; $('instBtn').classList.add('hidden'); return; }
  $('instBtn').classList.toggle('hidden', !PWA.prompt);
  $('instTxt').textContent = PWA.prompt ? 'מוסיף את "מי בבית" למסך הבית, עם אייקון משלה ובמסך מלא'
    : ios ? 'באייפון: לחץ על כפתור השיתוף בספארי, ואז "הוסף למסך הבית"' : 'בתפריט הדפדפן (⋮) בחר "התקן אפליקציה" או "הוסף למסך הבית"';
}
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); PWA.prompt = e; renderInstall(); });
window.addEventListener('appinstalled', () => { PWA.prompt = null; renderInstall(); toast(null, '✓ הותקן', '"מי בבית" נוספה למסך הבית'); });
$('instBtn').onclick = async () => { if (!PWA.prompt) return; PWA.prompt.prompt(); try { await PWA.prompt.userChoice; } catch (e) {} PWA.prompt = null; renderInstall(); };
renderInstall();
if ('serviceWorker' in navigator) window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
