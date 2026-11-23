/* ---------- דיבור ---------- */
let speaking = false, speakingUntil = 0, speakStart = 0;
setInterval(() => { if (speaking && Date.now() - speakStart > 15000 && !(window.speechSynthesis && speechSynthesis.speaking)) { speaking = false; sirenLevel(); } }, 2000);
try { speechSynthesis.onvoiceschanged = () => { window.__voices = speechSynthesis.getVoices(); }; speechSynthesis.getVoices(); } catch (e) {}
function hebVoice() { try { const vs = speechSynthesis.getVoices().length ? speechSynthesis.getVoices() : window.__voices || []; return vs.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('he')); } catch (e) { return null; } }
function speak(text, urgent) {
  if (!window.speechSynthesis) return;
  try {
    if (urgent) speechSynthesis.cancel();
    showCaption(text);
    const u = new SpeechSynthesisUtterance(text); u.lang = 'he-IL'; u.rate = 0.95; u.volume = 1;
    const v = hebVoice(); if (v) u.voice = v;
    u.onstart = () => { speaking = true; speakStart = Date.now(); sirenLevel(); };
    u.onend = u.onerror = () => { speaking = speechSynthesis.speaking; speakingUntil = Date.now() + 900; sirenLevel(); };
    speechSynthesis.speak(u);
  } catch (e) {}
}

/* ---------- זיהוי דיבור: "כן" / "בסדר" ---------- */
let rec = null, recOn = false, recBlocked = false, recFails = 0;
const YES = /(^|\s)(כן|בסדר|הכל טוב|הכול טוב|אני בסדר|אני בסדר גמור|טוב|אוקיי|אוקי|בטח)(\s|$|[.!,])/;
function needRec() { return running && S.settings.voiceAnswer && (medPending.length > 0 || Object.keys(G).some((k) => G[k].state === 'asking' || G[k].state === 'emergency' || G[k].state === 'verify')); }
function syncRec() { const w = needRec(); if (w && !recOn) startRec(); else if (!w && recOn) { try { rec.stop(); } catch (e) {} recOn = false; } }
function startRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
  try {
    rec = new SR(); rec.lang = 'he-IL'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = (e) => {
      if (speaking || Date.now() < speakingUntil) return; // לא לשמוע את המערכת עצמה
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = (e.results[i][0].transcript || '').trim();
        const asking = guarded().filter((p) => G[p.id] && (G[p.id].state === 'asking' || G[p.id].state === 'emergency' || G[p.id].state === 'verify'));
        if (asking.some((p) => txt.includes(p.name)) || /תזוז|תרים|שואל/.test(txt)) continue; // הד של השאלה
        if (/לקחתי|לקחנו|לקחה/.test(txt) && medPending.length) { medPending.slice().forEach((m) => medConfirm(m.key, 'בקול')); break; }
        if (YES.test(' ' + txt + ' ')) { asking.forEach((p) => onResponse(p, 'speech')); break; }
      }
    };
    rec.onend = () => { recOn = false; if (needRec() && !recBlocked) { recFails = Math.min(recFails + 1, 6); setTimeout(startRec, 400 * recFails); } };
    rec.onerror = (e) => { if (e && /not-allowed|service-not-allowed/.test(e.error)) { recBlocked = true; toast(null, 'אין הרשאה לזיהוי דיבור', 'אפשר לענות בתנועה, בהרמת יד או בכפתור'); } };
    rec.onresult0 = rec.onresult; rec.onresult = (e) => { recFails = 0; rec.onresult0(e); };
    rec.start(); recOn = true;
  } catch (e) { recOn = false; }
}

/* ---------- סירנה ---------- */
let siren = null, sirenMuted = false;
function sirenStart() {
  if (siren) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
    const o = actx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 960;
    const lfo = actx.createOscillator(); lfo.frequency.value = 0.65;
    const lg = actx.createGain(); lg.gain.value = 380; lfo.connect(lg); lg.connect(o.frequency);
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3000;
    const g = actx.createGain(); g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(actx.destination); o.start(); lfo.start();
    siren = { o, lfo, g }; sirenLevel();
  } catch (e) {}
}
function sirenLevel() {
  if (!siren) return;
  const v = (S.settings.sirenVol != null ? S.settings.sirenVol : 0.8) * (speaking ? 0.12 : 1) * (sirenMuted ? 0 : 1);
  try { siren.g.gain.setTargetAtTime(v * 0.55, actx.currentTime, 0.08); } catch (e) {}
}
function sirenStop() { if (!siren) return; try { siren.g.gain.setTargetAtTime(0, actx.currentTime, 0.05); const s = siren; setTimeout(() => { try { s.o.stop(); s.lfo.stop(); } catch (e) {} }, 300); } catch (e) {} siren = null; }

