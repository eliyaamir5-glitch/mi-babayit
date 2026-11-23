// יוצר קובץ וידאו למצלמה המדומה: תמונת פנים מוגדלת מתוך תמונת הדוגמה של ספריית Human.
// הקובץ נוצר בזמן הבדיקה ולא נשמר ב-git (אין תמונות של אנשים במאגר).
const fs = require('fs');
const path = require('path');
const { chromium } = require('@playwright/test');

module.exports = async (config) => {
  const out = path.join(__dirname, '..', 'test-results', 'fake-camera.mjpeg');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const src = fs.readFileSync(path.join(__dirname, '..', 'node_modules/@vladmandic/human/assets/samples.jpg')).toString('base64');
  const launch = config.projects[0].use.launchOptions || {};
  const browser = await chromium.launch({ executablePath: launch.executablePath });
  const page = await browser.newPage();
  const b64 = await page.evaluate(async (src) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + src; await img.decode();
    const c = document.createElement('canvas'); c.width = 1280; c.height = 720;
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high';
    x.drawImage(img, 366, 0, 160, 90, 0, 0, 1280, 720); // האיש בתמונה השלישית בשורה העליונה
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, src);
  await browser.close();
  const frame = Buffer.from(b64, 'base64');
  fs.writeFileSync(out, Buffer.concat(Array(10).fill(frame))); // MJPEG = תמונות JPEG ברצף
  fs.writeFileSync(out.replace('.mjpeg', '.jpg'), frame);
};
