/* =========================================================
   בקרת עומס ואבחון
   1) בקרת עומס: מודדים כמה זמן לוקח כל סבב זיהוי. כשהמכשיר לא עומד בקצב, מוותרים קודם על
      התוספות הכבדות (זום על גוף, גופים רחוקים, זיהוי גוף לצורך "מראה") — זיהוי הפנים והשמירה לא נפגעים.
   2) דוח אבחון: מספרים בלבד (בלי שמות, תמונות או פנים) שאפשר להעתיק ולשלוח, כדי לכוון את המערכת לפי מה שקורה באמת.
   ========================================================= */
const PERF = { ms: 0, level: 0, t0: 0, since: 0, votes: [], slowAt: 0 };
// רמה 0: הכול פועל · 1: בלי זום על גוף ובלי גופים רחוקים · 2: גם זיהוי גוף ל"מראה" רק בכל סבב שלישי
function perfLevelFor(ms) { return ms > 900 ? 2 : ms > 450 ? 1 : 0; }
function perfStart() { PERF.t0 = performance.now(); }
function perfEnd() {
  if (!PERF.t0) return;
  const d = performance.now() - PERF.t0; PERF.t0 = 0;
  PERF.ms = PERF.ms ? PERF.ms * 0.8 + d * 0.2 : d;
  const want = perfLevelFor(PERF.ms), now = Date.now();
  // עולים רמה מיד, יורדים רק אחרי 10 שניות יציבות (בלי לקפוץ הלוך וחזור)
  if (want > PERF.level) { PERF.level = want; PERF.since = now; }
  else if (want < PERF.level && now - PERF.since > 10000) { PERF.level = want; PERF.since = now; }
  if (PERF.level === 2 && now - PERF.slowAt > 30 * 60000 && (S.settings.looks || S.settings.bodySharp)) {
    PERF.slowAt = now; toast(null, '🐢 המכשיר מתקשה', 'כיביתי זמנית תוספות כבדות כדי שזיהוי הפנים יישאר מהיר');
  }
}
// רישום של כל החלטת זיהוי (מספרים בלבד) — לדוח האבחון
function diagVote(m, need, vote, small) {
  PERF.votes.push({ s: Math.round(m.sim * 1000) / 1000, s2: Math.round(m.second * 1000) / 1000, need: Math.round(need * 1000) / 1000, r: vote === null ? 'none' : vote === 'maybe' ? 'maybe' : 'yes', small: small ? 1 : 0 });
  if (PERF.votes.length > 400) PERF.votes.shift();
}
function diagReport() {
  const st = S.settings, v = PERF.votes, yes = v.filter((x) => x.r === 'yes'), maybe = v.filter((x) => x.r === 'maybe'), none = v.filter((x) => x.r === 'none');
  const avg = (a, k) => (a.length ? (a.reduce((t, x) => t + x[k], 0) / a.length).toFixed(3) : '-');
  const close = yes.filter((x) => x.s - x.s2 < 0.08).length; // זיהויים שבהם המועמד השני היה קרוב — סיכון לשם שגוי
  const lines = [
    'מי בבית — דוח אבחון (מספרים בלבד, בלי שמות ותמונות)',
    `גרסה: ${(document.querySelector('.logo small') || {}).textContent || ''}`,
    `דפדפן: ${navigator.userAgent}`,
    `מנוע: ${engineName || 'לא נטען'} · ליבות: ${navigator.hardwareConcurrency || '?'} · זיכרון: ${navigator.deviceMemory || '?'}GB`,
    `מצלמה: ${running ? video.videoWidth + 'x' + video.videoHeight : 'כבויה'} · טווח זיהוי: ${st.quality} · סביבה: ${st.env}`,
    `מהירות: ${fpsT.length} סבבים בשנייה · ${Math.round(PERF.ms)} אלפיות שנייה לסבב · רמת עומס ${PERF.level}`,
    `בהירות ממוצעת: ${Math.round(NIGHT.mean)} (0–255) · הבהרה: x${NIGHT.gain.toFixed(2)}`,
    `אנשים: ${S.people.filter((p) => p.name).length} עם שם, ${S.people.filter((p) => !p.name).length} לא מזוהים · דוגמאות פנים לאדם: ${S.people.map((p) => p.samples.length).join(',') || '-'}`,
    `סף ודאות: ${st.threshold} · פנים במעקב עכשיו: ${tracks.length} · גופים: ${bodies.length}`,
    `תוספות: מראה=${st.looks ? 'כן' : 'לא'} גוף חד=${st.bodySharp ? 'כן' : 'לא'} שלד=${st.bodyDraw ? 'כן' : 'לא'} רגשות=${st.emotions ? 'כן' : 'לא'} חושך=${st.night !== false ? 'כן' : 'לא'} שמירה=${guardActive() ? 'פעילה' : 'לא'}`,
    `החלטות זיהוי אחרונות (${v.length}): זוהה=${yes.length} · אולי=${maybe.length} · לא מוכר=${none.length} · פנים קטנות=${v.filter((x) => x.small).length}`,
    `דמיון ממוצע: כשזוהה ${avg(yes, 's')} (מועמד שני ${avg(yes, 's2')}) · כש"אולי" ${avg(maybe, 's')} · כשלא מוכר ${avg(none, 's')}`,
    `זיהויים עם מועמד שני קרוב (סיכון לשם שגוי): ${close} מתוך ${yes.length}`,
  ];
  return lines.join('\n');
}
