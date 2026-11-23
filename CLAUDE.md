# מי בבית — הנחיות לפרויקט

אפליקציית ווב (PWA) לשמירה חכמה על הבית: זיהוי פנים, שמירה על אנשים לפי פרופיל, חיישני שמע, אזורים, הגעות צפויות, אימות חכם מול האחראי, חיות מחמד, מצב "בית ריק" וסנכרון בין כמה מצלמות.
הבעלים: צוריאל עמיר. מדברים איתו בעברית, בלי לערבב עברית ואנגלית באותו משפט.

## מצב נוכחי
- האתר כולו בתיקייה `site/`: `index.html` (המבנה), `css/style.css`, ו־36 קבצי סקריפט ב־`site/js/` לפי נושא.
- **אין שלב בנייה ואין framework.** הקבצים הם סקריפטים רגילים (לא מודולים) שנטענים לפי הסדר ב־`index.html` וחולקים משתנים גלובליים (`S`, `CFG`, `tracks`...). לכן:
  - סדר הקבצים חשוב. קוד שרץ מיד בטעינה לא יכול להשתמש בפונקציה שמוגדרת בקובץ מאוחר יותר. `npm run check` בודק את זה.
  - קובץ חדש מוסיפים גם כשורת `<script>` ב־`site/index.html`, במקום הנכון בסדר.
- רץ בדפדפן בלבד. אין שרת, ואין שמירת מידע בענן.
- הגרסה המקורית בקובץ אחד שמורה בתגית git בשם `v9-original`.

## פקודות
- `npm install` — פעם אחת.
- `npm run dev` — שרת פיתוח מקומי בכתובת http://localhost:5173
- `npm test` — בדיקת סדר הקבצים, ואז Playwright עם מצלמה מדומה: האפליקציה עולה בלי שגיאות, המנוע נטען, פנים מזוהות ונוצר אדם "לא מזוהה". **להריץ לפני כל דחיפה.**
  - הבדיקה מגישה את ספריית Human והמודלים מ־`node_modules` במקום מהאינטרנט.
  - סרטון המצלמה המדומה נוצר בזמן הבדיקה (`tests/make-fake-camera.js`) ולא נשמר ב־git.

## פרסום
- Netlify מחובר למאגר ב־GitHub ומפרסם את `site/` (ראו `netlify.toml`). כל דחיפה לענף `main` מעדכנת את האתר באותו קישור. אין צורך ב־Netlify Drop.

## עקרונות שאסור לשבור
1. **פרטיות:** וידאו, פנים, תמונות ופרופילים נשמרים רק במכשיר (IndexedDB). כלום לא נשלח לשרת, חוץ מהתראות שהמשתמש הפעיל (ntfy, webhook).
2. **ממשק בעברית, מימין לשמאל**, בעיצוב כהה ומודרני. כל טקסט למשתמש בעברית.
3. **נגישות לפי ת"י 5568 (WCAG 2.0 AA):** תוויות לקוראי מסך, הפעלה במקלדת, תפריט נגישות, הצהרת נגישות, כתוביות לכל דיבור.
4. **יציאה קלה מכל חלון:** ✕, לחיצה בחוץ, Esc, וכפתור "חזור" בטלפון (history API).
5. **בלי זום מקרי ובלי קפיצות:** שדות קלט בגודל 16px לפחות בטלפון, `touch-action: manipulation`, וגובה קבוע לחלונות עם לשוניות.
6. **הערת בטיחות:** זה כלי עזר ולא מכשיר רפואי. במצב חירום מתקשרים ל־101. אין חיוג אוטומטי למד"א.
7. **אימות חכם קודם לאזעקה:** מצב חריג נשלח קודם לאחראי ("זה בסדר?"). "זה בסדר" משתיק את אותו מצב עד שיש שינוי. אזעקה אוטומטית רק אם אף אחד לא ענה.

## מפת הקוד (`site/js/`)
| קובץ | נושא | פונקציות עיקריות |
|---|---|---|
| `01-config-state.js` | הגדרות ומצב | `CFG`, `S`, `S.settings` |
| `02-storage.js` | אחסון (IndexedDB) | `DB.open/get/set`, `save` |
| `03-helpers.js`, `04-sound-voice.js` | עזרים, צלילים וקול | `toast`, `beep` |
| `05-engine.js` | מנוע זיהוי (Human 3.3.6 מ־jsdelivr), מצלמה | `initEngine`, `makeHuman`, `startCam`, `stopCam` |
| `06-detect-loop.js` | זיהוי בכמה קני מידה | `detectLoop` |
| `07-tracking.js` | מעקב וזיהוי פנים | `process`, `bestPerson`, `scorePerson`, `assign`, `createUnknown` |
| `08-guard.js` | מנוע השמירה | `guardTick`, `posture`, `torso`, `handRaised`, `associateBodies` |
| `09-check-verify.js` | בדיקה, חירום ואימות חכם | `trigger`, `verifyStart/Ok/Alarm`, `stepFlow`, `resolve`, `emergency` |
| `10-speech-siren.js` | דיבור, זיהוי דיבור, סירנה | `speak`, `startRec`, `sirenStart` |
| `11-alerts.js` | התראות החוצה | `sendAlerts` (ntfy, webhook, התראות דפדפן) |
| `12-guard-ui.js` | ממשק השמירה, מסך דלוק | `renderGuard`, `renderEmergency`, `syncWake` |
| `13-env.js`, `14-audio-sensors.js`, `15-emotions.js` | סביבות, שמע, רגשות | `ENVS`, `applyEnv`, `onAudio`, `soundEvent`, `updateEmotion` |
| `16-device.js` | סוללה ואינטרנט | `checkDevice`, `devLine` |
| `17-schedule.js`, `18-summary.js`, `19-remote.js` | לוח יומי, סיכום, שליטה מרחוק | `schedTick`, `dailySummary`, `onRemote` (ערוץ `<topic>-cmd`) |
| `20-clips.js`, `21-soothe.js`, `22-heartbeat-selftest.js`, `23-hero-card.js` | קטעי וידאו, הרגעה, דופק ובדיקת מערכת, כרטיס מצב | `recSeg`, `sootheStart`, `selfTest`, `heroCard` |
| `24-zones.js`, `25-arrivals.js` | אזורים והגעות צפויות | `zoneTick`, `zoneEnter`, `arrivalSeen`, `arrTick`, `openArrival` |
| `26-pets.js`, `27-armed.js` | חיות מחמד ובית ריק | `petPass` (מודל centernet), `armedCheck` |
| `28-sync.js` | סנכרון מצלמות | `syncHouse`, `syncSend`, `onSync` (ערוץ `<topic>-sync`), `shareProfiles` |
| `29-draw.js` | ציור על הווידאו | `drawLoop`, `drawZones`, `drawBodies`, `drawPets` |
| `30-ui.js` | רשימות ויומן | `render` |
| `31-rules.js`, `32-profile.js`, `33-settings.js` | כללים, פרופיל, הגדרות | `autoRules`, `effRules`, `openName`, `syncSettings` |
| `34-modals.js`, `35-a11y.js` | חלונות ונגישות | `setupModal`, `closeModal`, `applyA11y`, `renderStmt` |
| `36-boot.js` | עלייה | טעינת המצב ו־`initEngine` |

## מה נבדק ומה לא
- **נבדק** (בכרום בלי ממשק גרפי, עם מצלמה וקול מדומים): זיהוי ומתן שמות, שני אנשים באותה נקודה, זיהוי מרחוק, זרימת "לא זז" ← אימות ← "זה בסדר" ← שתיקה עד שינוי, אזעקה אוטומטית, הגעה דרך דלת מסומנת, תזכורת תרופה, קטעי וידאו, בכי, צעקה ומכה, וסגירת חלונות.
- **לא נבדק:** כל מה שעובר דרך השרת של ntfy (כפתורי פעולה, ערוצי cmd ו־sync, העברת פרופילים), מנוע הקולות החכם (YAMNet ב־MediaPipe), זיהוי כלבים וחתולים אמיתיים, ספארי באייפון, ונפילה אמיתית.

## תוכנית עבודה
- ✅ פיצול לקבצים בלי שינוי התנהגות, git, בדיקות Playwright עם מצלמה מדומה, פרסום אוטומטי ב־Netlify.
1. PWA אמיתי: manifest ו־service worker (גם להתראות בטלפון), אייקון למסך הבית.
2. להרחיב את הבדיקות האוטומטיות (שמות, אימות חכם, אזורים) עם `--use-file-for-fake-audio-capture`.
3. לבדוק בפועל את ntfy ואת הסנכרון בין שני מכשירים.
4. בהמשך: אפליקציה לטלפון (React Native עם Expo). מכשיר השמירה עדיף על אנדרואיד, ואייפון מקבל התראות.
