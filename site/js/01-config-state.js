/* =========================================================
   מי בבית — זיהוי פנים בדפדפן
   מנוע: Human (BlazeFace + FaceMesh + FaceRes)
   ========================================================= */
const LIB = window.MIBABAYIT_BASE || 'https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/';
/* כל הספים בדמיון קוסינוס (0..1). נמדד בבדיקה: אנשים שונים הגיעו עד 0.55, אותו אדם 0.84 ומעלה */
const CFG = {
  smallFace: 64,         // פנים קטנות מזה (רחוקות) — דורשות ודאות גבוהה יותר
  smallPenalty: 0.03,
  margin: 0.04,          // הפער המינימלי בין המועמד הראשון לשני
  maybeGap: 0.08,        // מתחת לסף בפער הזה = "לא בטוח", לא יוצרים אדם חדש
  votesWindow: 7,        // כמה פריימים אחרונים משתתפים בהצבעה
  votesToAssign: 4,      // כמה קולות צריך כדי לקבוע זהות
  dropAfter: 3,          // כמה פריימים ברצף שלא מאשרים את השם — והשם יורד
  dropHard: 0.15,        // ירידה חדה מתחת לסף = הורדת שם מיידית
  minEnrollPx: 60,       // גודל פנים מינימלי ליצירה וללמידה
  maxYaw: 0.40, maxPitch: 0.35,  // ברדיאנים — פנים כמעט חזיתיות
  minScore: 0.62,
  newPersonFrames: 6,    // פריימים איכותיים לפני יצירת "לא מזוהה"
  newPersonMinMs: 1000,
  maxSamples: 20,        // דוגמאות לכל אדם
  learnEveryMs: 1500,
  learnBonus: 0.06,      // לומדים רק כשבטוחים: סף + הבונוס הזה
  learnMaxSim: 0.94,     // לא ללמוד דוגמאות כמעט זהות
  stableToLearn: 5,      // כמה אישורים ברצף לפני שמתחילים ללמוד
  trackTTL: 1200,        // כמה זמן מסגרת נשארת אחרי שהפנים נעלמו
  visitGap: 90 * 1000,   // אחרי כמה זמן בלי לראות = כניסה חדשה
};
const QUALITY = { fast: 640, balanced: 1280, far: 1920, sharp: 1920 };

const $ = (id) => document.getElementById(id);
const video = $('video'), canvas = $('canvas'), ctx = canvas.getContext('2d');

let human = null;
let S = { people: [], log: [], counter: 1, settings: { threshold: 0.68, voice: true, sound: true, mirror: true, quality: 'balanced', engine: 'auto', v4: true,
  guardOn: true, motionSens: 5, sleepOn: false, sleepFrom: '23:00', sleepTo: '06:00', voiceAnswer: true, sirenVol: 0.8, wakeLock: true,
  ntfyOn: false, ntfyTopic: '', ntfyServer: 'https://ntfy.sh', webhook: '', notifOn: false, remindMin: 3,
  env: 'living', privacy: false, emotions: true, skeleton: false, clips: true, remoteOn: true, summaryOn: false, summaryAt: '21:00', heartbeat: '', sootheVol: 0.35,
  snd: { on: false, engine: 'auto', noiseDb: 26, cooldown: 60, speakNotify: true, soothe: false, sootheMin: 5,
    cry: { on: false, sec: 4, act: 'notify' }, scream: { on: true, act: 'ask' }, loud: { on: true, act: 'notify' }, smoke: { on: true, act: 'emergency' }, glass: { on: false, act: 'notify' }, bark: { on: false, act: 'notify' } },
  verifyMode: 'smart', autoEscMin: 10, verifyRemind: 3, verifyAsk: true, stillWhileSleep: false, camName: '', devId: '', syncOn: true, syncSiren: false, armed: false, armSiren: false, armAuto: true, showZones: true, dangerAll: false, dangerSpeak: true, pets: { on: false, missH: 0 } }, safety: [] };
const SND_DEFAULT = JSON.parse(JSON.stringify(S.settings.snd));
let tracks = []; let trackSeq = 1; let loopGen = 0;
let running = false, stream = null;
let fpsT = [], lastUiRender = 0, editingId = null;

