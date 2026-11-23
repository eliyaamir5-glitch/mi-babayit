/* =========================================================
   חלונות: יציאה קלה מכל חלון (✕, לחיצה בחוץ, Esc, כפתור "חזור" בטלפון)
   ========================================================= */
const MODAL_CLOSE = { nameModal: () => closeName(), clipModal: () => $('clipClose').click(), zoneModal: () => zoneFormCancel() };
let modalPopping = false, lastFocus = null;
function closeModal(m) { if (!m || !m.classList.contains('open')) return; const f = MODAL_CLOSE[m.id]; if (f) f(); else m.classList.remove('open'); }
const openModals = () => [...document.querySelectorAll('.modal.open')];
function setupModal(m) {
  if (m._setup) return; m._setup = true;
  m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
  const box = m.querySelector('.mbox'), t = box && box.querySelector('h3');
  if (t) { t.id = t.id || m.id + 'T'; m.setAttribute('aria-labelledby', t.id); }
  if (box && !box.querySelector('.xclose') && !box.querySelector('.pclose')) { const b = document.createElement('button'); b.className = 'xclose'; b.setAttribute('aria-label', 'סגור'); b.textContent = '✕'; box.prepend(b); }
  m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.xclose')) closeModal(m); });
  new MutationObserver(() => {
    const open = m.classList.contains('open');
    if (open && !m._open) {
      m._open = true; lastFocus = document.activeElement;
      try { history.pushState({ mb: m.id }, ''); m._pushed = true; } catch (e) {}
      setTimeout(() => { const f = m.querySelector('input:not([type=hidden]),.xclose,.pclose,button'); if (f && !m.contains(document.activeElement)) try { f.focus({ preventScroll: true }); } catch (e) {} }, 60);
    } else if (!open && m._open) {
      m._open = false;
      if (m._pushed) { m._pushed = false; if (!modalPopping && history.state && history.state.mb === m.id) try { history.back(); } catch (e) {} }
      try { lastFocus && lastFocus.focus({ preventScroll: true }); } catch (e) {}
    }
    document.body.classList.toggle('modal-open', openModals().length > 0);
  }).observe(m, { attributes: true, attributeFilter: ['class'] });
}
document.querySelectorAll('.modal').forEach(setupModal);
window.addEventListener('popstate', () => { const top = openModals().pop(); if (top) { modalPopping = true; top._pushed = false; closeModal(top); modalPopping = false; } });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { const top = openModals().pop(); if (top && top.id !== 'nameModal') closeModal(top); }
  // מלכודת פוקוס בתוך חלון פתוח (מקלדת / קורא מסך)
  if (e.key === 'Tab') { const top = openModals().pop(); if (!top) return; const f = [...top.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter((x) => !x.disabled && x.offsetParent); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
  // אנשים ברשימה נפתחים גם במקלדת
  if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('person')) { e.preventDefault(); e.target.click(); }
});
// מניעת זום בלחיצה כפולה (iOS) בלי לחסום הגדלה של מערכת ההפעלה לנגישות
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => { const n = Date.now(); if (n - lastTouchEnd < 320 && !e.target.closest('input,textarea,select')) e.preventDefault(); lastTouchEnd = n; }, { passive: false });

