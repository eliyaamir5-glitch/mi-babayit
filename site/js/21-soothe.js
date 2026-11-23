/* =========================================================
   הרגעה: שיר ערש ורעש לבן (מיוצרים בדפדפן)
   ========================================================= */
const SOOTHE = { node: null, until: 0, kind: '', timer: 0 };
function sootheStart(kind, minutes) {
  sootheStop();
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume();
    const out = actx.createGain(); out.gain.value = 0; out.connect(actx.destination);
    out.gain.setTargetAtTime((S.settings.sootheVol != null ? S.settings.sootheVol : 0.35), actx.currentTime, 1.2);
    const nodes = [out];
    if (kind === 'noise') {
      const len = actx.sampleRate * 4, buf = actx.createBuffer(1, len, actx.sampleRate), d = buf.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0; // רעש ורוד — רך יותר מרעש לבן
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.05) * 0.6; }
      const src = actx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(out); src.start(); nodes.push(src);
    } else {
      // שיר הערש של בראמס (1868, נחלת הכלל) — צלילים רכים
      const N = { E4: 329.6, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F4: 349.2, D4: 293.7, C4: 261.6 };
      const mel = [['E4', 1], ['E4', 1], ['G4', 3], ['E4', 1], ['E4', 1], ['G4', 3], ['E4', 1], ['G4', 1], ['C5', 2], ['B4', 2], ['A4', 2], ['A4', 2], ['G4', 2], ['D4', 1], ['E4', 1], ['F4', 2], ['D4', 2], ['D4', 1], ['E4', 1], ['F4', 3], ['D4', 1], ['F4', 1], ['B4', 1], ['A4', 1], ['G4', 2], ['B4', 2], ['C5', 4]];
      const beat = 0.42; let t = actx.currentTime + 0.3;
      const total = mel.reduce((a, m) => a + m[1], 0) * beat + 1.2;
      const play = (start) => {
        let tt = start;
        for (const [n, l] of mel) {
          const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = N[n];
          g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.5, tt + 0.06); g.gain.exponentialRampToValueAtTime(0.001, tt + l * beat * 1.4);
          o.connect(g); g.connect(out); o.start(tt); o.stop(tt + l * beat * 1.5); tt += l * beat;
        }
      };
      play(t);
      SOOTHE.loop = setInterval(() => { t += total; play(t); }, total * 1000);
    }
    SOOTHE.node = nodes; SOOTHE.kind = kind; SOOTHE.until = Date.now() + (minutes || 10) * 60000;
    SOOTHE.timer = setTimeout(sootheStop, (minutes || 10) * 60000);
  } catch (e) {}
  renderGuard();
}
function sootheStop() {
  clearTimeout(SOOTHE.timer); clearInterval(SOOTHE.loop);
  if (SOOTHE.node) { const [out, ...rest] = SOOTHE.node; try { out.gain.setTargetAtTime(0, actx.currentTime, 0.4); setTimeout(() => { rest.forEach((n) => { try { n.stop(); } catch (e) {} }); try { out.disconnect(); } catch (e) {} }, 1500); } catch (e) {} }
  SOOTHE.node = null; SOOTHE.kind = ''; SOOTHE.listenUntil = Date.now() + 20000; renderGuard();
}

