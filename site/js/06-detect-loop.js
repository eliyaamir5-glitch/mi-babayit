/* ---- זיהוי בכמה קני מידה: פריים מלא + אריחים מוגדלים + זום על כל פנים שנמצאו ---- */
const CV = { full: document.createElement('canvas'), tile: document.createElement('canvas'), roi: document.createElement('canvas') };
let tileIdx = 0, cycle = 0;
function grab(cv, sx, sy, sw, sh, cw, ch) {
  cw = Math.round(cw); ch = Math.round(ch);
  if (cv.width !== cw) cv.width = cw; if (cv.height !== ch) cv.height = ch;
  cv.getContext('2d', { willReadFrequently: false }).drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
  return { sx, sy, kx: sw / cw, ky: sh / ch };
}
function mapFace(f, m) {
  const b = f.box;
  return { box: [m.sx + b[0] * m.kx, m.sy + b[1] * m.ky, b[2] * m.kx, b[3] * m.ky], embedding: f.embedding, score: f.score, rotation: f.rotation, age: f.age, emotion: f.emotion };
}
const NOBODY = () => ({ body: { enabled: false }, object: { enabled: false }, face: { enabled: true, emotion: { enabled: !!S.settings.emotions } } });
async function det(cv) { const r = await human.detect(cv, NOBODY()); return (r.face || []).filter((f) => f.embedding && f.embedding.length); }
function tiles(W, H) {
  const T = Math.round(Math.min(W, H) * 0.6), step = Math.round(T * 0.72), out = [];
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    out.push([Math.min(x, W - T), Math.min(y, H - T), T]);
    if (x + T >= W) break;
  }
  return out.filter((t, i, a) => a.findIndex((u) => u[0] === t[0] && u[1] === t[1]) === i);
}
function overlapsAny(box, list) {
  const cx = box[0] + box[2] / 2, cy = box[1] + box[3] / 2;
  return list.some((b) => iou(b, box) > 0.15 || (cx > b[0] && cx < b[0] + b[2] && cy > b[1] && cy < b[1] + b[3]));
}
async function detectLoop(gen) {
  if (gen === undefined) gen = loopGen;
  if (!running || gen !== loopGen) return;
  if (video.readyState >= 2 && !video.paused) {
    try {
      const W = video.videoWidth, H = video.videoHeight, now = Date.now();
      const obs = [];
      // 1) זום על כל פנים שכבר במעקב — חיתוך ברזולוציה מלאה, כך שגם פנים רחוקות מקבלות מספיק פיקסלים
      const active = tracks.filter((t) => now - t.seen < 600).sort((a, b) => b.box[2] - a.box[2]).slice(0, 4);
      for (const t of active) {
        const [x, y, w, h] = t.box;
        const side = Math.min(Math.min(W, H), Math.max(150, Math.max(w, h) * 2.6));
        const sx = Math.max(0, Math.min(W - side, x + w / 2 - side / 2)), sy = Math.max(0, Math.min(H - side, y + h / 2 - side / 2));
        const m = grab(CV.roi, sx, sy, side, side, 320, 320);
        const fs = await det(CV.roi);
        let best = null, bd = Infinity;
        for (const f of fs) { const d = Math.hypot(f.box[0] + f.box[2] / 2 - 160, f.box[1] + f.box[3] / 2 - 160); if (d < bd) { bd = d; best = f; } }
        if (best && bd < 110) obs.push(Object.assign(mapFace(best, m), { track: t }));
      }
      // 2) גילוי פנים חדשות: פריים מלא מוקטן (קרובים) + אריח אחד מוגדל בכל סבב (רחוקים)
      const passes = [];
      const guarding = guardActive();
      const scanFull = guarding || active.length === 0 || cycle % 2 === 0;
      const scanTile = active.length === 0 || (guarding ? cycle % 3 === 2 : cycle % 2 === 1);
      if (scanFull) { const cw = Math.min(640, W); passes.push(grab(CV.full, 0, 0, W, H, cw, H * cw / W)); passes[passes.length - 1].cv = CV.full; }
      if (scanTile && W >= 900) {
        const ts = tiles(W, H); const [tx, ty, T] = ts[tileIdx++ % ts.length];
        const m = grab(CV.tile, tx, ty, T, T, Math.min(T, 512), Math.min(T, 512)); m.cv = CV.tile; passes.push(m);
      }
      let gotBody = false;
      for (const m of passes) {
        const useBody = (guarding || lookOn()) && m.cv === CV.full;
        const r = await human.detect(m.cv, { body: { enabled: useBody, modelPath: BODY_MODEL, maxDetected: 5, minConfidence: 0.2 }, object: { enabled: false }, face: { enabled: true, emotion: { enabled: !!S.settings.emotions } } });
        const fs = (r.face || []).filter((f) => f.embedding && f.embedding.length);
        if (useBody) { bodies = (r.body || []).map((b) => mapBody(b, m)).filter((b) => b.score > 0.2); gotBody = true; }
        for (const f of fs) {
          const o = mapFace(f, m);
          if (overlapsAny(o.box, obs.map((x) => x.box)) || overlapsAny(o.box, active.map((t) => t.box))) continue;
          obs.push(o);
        }
      }
      if (!guarding && !lookOn()) bodies = [];
      cycle++;
      process(obs);
      lookTick(Date.now());
      zoneTick(Date.now()); armedCheck(Date.now());
      guardTick();
      syncRec();
      await petPass(Date.now()); // אחרי בדיקת השמירה, כדי לא לעכב אותה
    } catch (e) { console.error(e); }
    const now = performance.now(); fpsT.push(now); while (fpsT.length && now - fpsT[0] > 1000) fpsT.shift();
  }
  scheduleDetect();
}

