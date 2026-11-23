/* ---------------- sound & voice ---------------- */
let actx = null;
function chime(kind) {
  if (!S.settings.sound && kind === 'unk') return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'unk' ? [660, 520] : [523, 659, 784];
    notes.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * 0.12;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      o.start(t); o.stop(t + 0.4);
    });
  } catch (e) {}
}
function say(text) {
  if (!S.settings.voice || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'he-IL';
    const v = speechSynthesis.getVoices().find((v) => v.lang && v.lang.startsWith('he'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) {}
}
function toast(p, title, sub) {
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `${p ? `<img src="${p.thumb}">` : ''}<div><b>${esc(title)}</b><span>${esc(sub)}</span></div>`;
  $('toasts').prepend(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, 4200);
  while ($('toasts').children.length > 4) $('toasts').lastChild.remove();
}

