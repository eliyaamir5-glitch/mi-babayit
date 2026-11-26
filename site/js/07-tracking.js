/* ---------------- tracking + recognition ---------------- */
function process(faces) {
  const now = Date.now();
  const used = new Set();
  const thr = S.settings.threshold;
  for (const f of faces) {
    if (!f.box || !f.embedding || !f.embedding.length) continue;
    // שיוך למסגרת קיימת לפי חפיפה
    let tr = f.track && tracks.includes(f.track) && !used.has(f.track) ? f.track : null, bestI = 0.3;
    if (!tr) for (const t of tracks) { if (used.has(t)) continue; const v = iou(t.box, f.box); if (v > bestI) { bestI = v; tr = t; } }
    if (!tr) { tr = { id: trackSeq++, box: f.box.slice(), draw: f.box.slice(), born: now, votes: [], pid: null, good: [], bestQ: 0, bestThumb: null, sim: 0, stable: 0, learned: [], blocked: new Set() }; tracks.push(tr); }
    used.add(tr); tr.box = f.box.slice(); tr.seen = now; tr.face = f; delete f.track;

    const emb = norm(f.embedding);
    const qual = quality(f);
    const m = bestPerson(emb, tr.blocked);
    const small = Math.min(f.box[2], f.box[3]) < CFG.smallFace;
    const need = thr + (small ? CFG.smallPenalty : 0);
    let vote = null;
    if (m.person && m.sim >= need && m.sim - m.second >= CFG.margin) vote = m.person.id;
    else if (m.person && m.sim >= thr - CFG.maybeGap) vote = 'maybe';
    tr.votes.push(vote); if (tr.votes.length > CFG.votesWindow) tr.votes.shift();
    tr.sim = m.sim; tr.maybe = vote === 'maybe' ? m.person.id : null;
    diagVote(m, need, vote, small);

    // 1) אם השם הנוכחי כבר לא מאושר — מורידים אותו (מונע "הדבקת" שם לאדם אחר)
    if (tr.pid) {
      const cur = byId(tr.pid);
      const curSim = cur ? scorePerson(emb, cur) : 0;
      const last = tr.votes.slice(-CFG.dropAfter);
      if (!cur || curSim < thr - CFG.dropHard || (last.length >= CFG.dropAfter && last.every((v) => v !== tr.pid))) {
        tr.pid = null; tr.stable = 0;
      } else tr.sim = curSim;
    }
    // 2) הצבעה: שם נקבע רק כשרוב ברור של פריימים מסכים, כולל האחרון
    if (!tr.pid && vote && vote !== 'maybe') {
      const n = tr.votes.filter((v) => v === vote).length;
      if (n >= CFG.votesToAssign) assign(tr, vote, now);
    }

    if (tr.pid) {
      const p = byId(tr.pid);
      p.lastSeen = now;
      if (p.name && qual.ok) updateEmotion(p, f, now);
      tr.stable = vote === p.id ? tr.stable + 1 : 0;
      // 3) למידה רק כשבטוחים מאוד, כדי לא "להרעיל" את האדם בפנים של מישהו אחר
      if (qual.ok && vote === p.id && tr.stable >= CFG.stableToLearn && m.sim >= thr + CFG.learnBonus && m.sim < CFG.learnMaxSim && now - (p.lastLearn || 0) > CFG.learnEveryMs) {
        const sm = { e: Array.from(emb), img: thumbSmall(f.box), t: now };
        p.samples.push(sm); p.lastLearn = now; tr.learned.push({ pid: p.id, t: now });
        if (p.samples.length > CFG.maxSamples) dropRedundant(p);
        save();
      }
      if (qual.ok && !p.name && qual.q > (p.thumbQ || 0) * 1.25) { p.thumb = crop(f.box); p.thumbQ = qual.q; }
    } else if (qual.ok && vote === null) {
      tr.good.push({ e: emb, box: f.box.slice(), q: qual.q }); if (tr.good.length > 14) tr.good.shift();
      if (qual.q > tr.bestQ) { tr.bestQ = qual.q; tr.bestThumb = crop(f.box); }
      const recent = tr.votes.slice(-CFG.newPersonFrames);
      if (recent.length >= CFG.newPersonFrames && recent.every((x) => x === null) && tr.good.length >= CFG.newPersonFrames && now - tr.born > CFG.newPersonMinMs) {
        // כל הדוגמאות במסגרת חייבות להיות של אותו אדם, ואף אחת לא דומה לאדם קיים
        const g = tr.good;
        let coh = 0, n = 0; for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { coh += sim(g[i].e, g[j].e); n++; }
        const coherent = n && coh / n >= thr;
        const dup = g.some((x) => { const r = bestPerson(x.e); return r.person && r.sim >= thr - CFG.maybeGap; });
        if (coherent && !dup) createUnknown(tr, now); else if (!coherent) tr.good = tr.good.slice(-3);
      }
    }
  }
  tracks = tracks.filter((t) => now - t.seen < CFG.trackTTL);
  if (now - lastUiRender > 700) { render(); lastUiRender = now; }
}
function dropRedundant(p) {
  // מוחקים את הדוגמה הכי מיותרת (הכי דומה לאחרת), כך שנשמר מגוון זוויות ותאורות
  let worst = -1, worstSim = -1;
  for (let i = 1; i < p.samples.length; i++) {
    let mx = 0; for (let j = 0; j < p.samples.length; j++) if (i !== j) mx = Math.max(mx, sim(p.samples[i].e, p.samples[j].e));
    if (mx > worstSim) { worstSim = mx; worst = i; }
  }
  if (worst > 0) p.samples.splice(worst, 1);
}
function pickDiverse(items, n) {
  if (items.length <= n) return items.slice();
  const out = [items[items.length - 1]];
  while (out.length < n) {
    let best = null, bestD = -1;
    for (const it of items) { if (out.includes(it)) continue; const d = Math.min(...out.map((o) => 1 - sim(it.e, o.e))); if (d > bestD) { bestD = d; best = it; } }
    out.push(best);
  }
  return out;
}
function createUnknown(tr, now) {
  const picks = pickDiverse(tr.good, 5).map((x) => ({ e: Array.from(x.e), img: thumbSmall(x.box), t: now }));
  const p = { id: uid(), name: null, label: 'לא מזוהה ' + S.counter++, samples: picks, thumb: tr.bestThumb, thumbQ: tr.bestQ,
    firstSeen: now, lastSeen: now, visits: 0 };
  S.people.push(p);
  tr.good = [];
  assign(tr, p.id, now, true);
  tr.stable = CFG.stableToLearn;
  save();
}
function assign(tr, pid, now, isNew) {
  tr.pid = pid; tr.stable = 0;
  const p = byId(pid); if (!p) return;
  const fresh = isNew || now - (p.lastVisit || 0) > CFG.visitGap;
  p.lastSeen = now;
  if (fresh) {
    p.visits++; p.lastVisit = now;
    S.log.unshift({ t: now, id: p.id }); if (S.log.length > 500) S.log.length = 500;
    if (p.name) { arrivalSeen(p.id, null, null); syncSend({ type: 'seen', name: p.name }); }
    else arrivalSeen(null, null, null);
    if (p.name) { if (p.alert !== false) { toast(p, `${p.name} נכנס`, p.role ? `${p.role} · זוהה עכשיו` : 'זוהה עכשיו מול המצלמה'); chime('known'); say(p.greeting || `שלום ${p.name}`); } }
    else { toast(p, 'אדם לא מזוהה', 'לחץ על הרשימה כדי לתת לו שם'); chime('unk'); }
    save();
  }
  render();
}
// לחיצה על פנים בווידאו: "זה לא הוא" — מבטל את הזיהוי ומוחק מה שנלמד ממנו
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  const scale = Math.max(r.width / canvas.width, r.height / canvas.height); // object-fit: cover
  const ox = (r.width - canvas.width * scale) / 2, oy = (r.height - canvas.height * scale) / 2;
  let x = (e.clientX - r.left - ox) / scale; const y = (e.clientY - r.top - oy) / scale;
  if (S.settings.mirror) x = canvas.width - x;
  return [x, y];
}
canvas.addEventListener('click', (e) => {
  if (ZE.on) return;
  const [x, y] = canvasPoint(e);
  const t = tracks.find((t) => x >= t.box[0] && x <= t.box[0] + t.box[2] && y >= t.box[1] && y <= t.box[1] + t.box[3] + t.box[3] * 0.5);
  if (!t || !t.pid) return;
  const p = byId(t.pid); if (!p) return;
  wrongTrack = t;
  $('wrText').textContent = `זה לא ${nameOf(p)}?`;
  $('wrModal').classList.add('open');
});
let wrongTrack = null;
function markWrong() {
  const t = wrongTrack; if (!t || !t.pid) return;
  const p = byId(t.pid);
  if (p) { const ts = new Set(t.learned.filter((l) => l.pid === p.id).map((l) => l.t)); p.samples = p.samples.filter((s) => !ts.has(s.t)); }
  t.blocked.add(t.pid); t.pid = null; t.votes = []; t.stable = 0; t.good = [];
  save(); render(); toast(null, 'תוקן', 'הזיהוי בוטל, והמבטים שנלמדו מהפנים האלה נמחקו');
}

