/* =========================================================
   קטעי וידאו לכל אירוע — שומרים את 8 השניות שלפני ואת 8 השניות שאחרי
   ========================================================= */
const REC = { mr: null, mime: '', prev: null, want: [], timer: 0 };
function recStart() {
  if (!S.settings.clips || !window.MediaRecorder || !stream || REC.mr) return;
  REC.mime = ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
  recSeg();
}
function recSeg() {
  if (!running || !stream || !S.settings.clips) { REC.mr = null; return; }
  let mr; try { mr = new MediaRecorder(stream, REC.mime ? { mimeType: REC.mime, videoBitsPerSecond: 700000 } : undefined); } catch (e) { REC.mr = null; return; }
  const parts = [], t0 = Date.now();
  mr.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
  mr.onstop = () => {
    const blob = new Blob(parts, { type: REC.mime || 'video/webm' }), seg = { blob, t0, t1: Date.now() };
    // שומרים קטע שבו קרה אירוע, ואת הקטע שלפניו
    const hits = REC.want.filter((w) => w.t >= t0 - 500 && w.t <= seg.t1);
    hits.forEach((w) => { saveClip(w.id + ':b', REC.prev); saveClip(w.id + ':a', seg); });
    REC.want = REC.want.filter((w) => !hits.includes(w) && Date.now() - w.t < 30000);
    REC.prev = seg;
  };
  try { mr.start(1000); } catch (e) { REC.mr = null; return; }
  REC.mr = mr;
  REC.timer = setTimeout(() => { try { mr.stop(); } catch (e) {} if (running) recSeg(); else REC.mr = null; }, 8000);
}
function recStop() { clearTimeout(REC.timer); try { REC.mr && REC.mr.stop(); } catch (e) {} REC.mr = null; }
function wantClip() {
  if (!S.settings.clips || envCfg().privacy || !REC.mr) return null;
  const id = 'c' + Date.now().toString(36); REC.want.push({ id, t: Date.now() }); return id;
}
function saveClip(key, seg) {
  if (!seg || !seg.blob || !seg.blob.size || !DB.db) return;
  try {
    DB.db.transaction('kv', 'readwrite').objectStore('kv').put({ blob: seg.blob, t0: seg.t0 }, 'clip:' + key);
    S.clips = (S.clips || []).filter((k) => k !== key); S.clips.push(key);
    while (S.clips.length > 30) { const old = S.clips.shift(); try { DB.db.transaction('kv', 'readwrite').objectStore('kv').delete('clip:' + old); } catch (e) {} }
    save();
    if ($('emOverlay').classList.contains('open')) renderEmergency(true);
  } catch (e) {}
}
async function loadClip(key) { const v = await DB.get('clip:' + key); return v && v.blob ? URL.createObjectURL(v.blob) : null; }
async function openClip(id) {
  const [b, a] = await Promise.all([loadClip(id + ':b'), loadClip(id + ':a')]);
  if (!b && !a) { toast(null, 'הקטע עוד לא מוכן', 'נסה שוב בעוד כמה שניות'); return; }
  $('clipBox').innerHTML = (b ? `<figure><video src="${b}" controls playsinline muted></video><figcaption>8 שניות לפני</figcaption></figure>` : '') + (a ? `<figure><video src="${a}" controls autoplay playsinline muted></video><figcaption>רגע האירוע</figcaption></figure>` : '');
  $('clipModal').classList.add('open');
}

