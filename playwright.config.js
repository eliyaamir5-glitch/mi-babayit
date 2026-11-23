// בדיקות אוטומטיות: כרום בלי ממשק גרפי, עם מצלמה ומיקרופון מדומים.
const path = require('path');
const fs = require('fs');
const FAKE_VIDEO = path.join(__dirname, 'test-results', 'fake-camera.mjpeg');
const sysChrome = '/opt/pw-browsers/chromium'; // קיים רק בסביבת הענן של Claude
const executablePath = fs.existsSync(sysChrome) && fs.statSync(sysChrome).isFile() ? sysChrome : undefined;

module.exports = {
  testDir: 'tests',
  timeout: 120_000,
  workers: 1,
  outputDir: 'test-results/out',
  globalSetup: require.resolve('./tests/make-fake-camera.js'),
  reporter: [['list']],
  webServer: {
    command: 'npx sirv site --port 5173 --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
  },
  use: {
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:5173',
    permissions: ['camera', 'microphone'],
    trace: 'off',
    launchOptions: {
      executablePath,
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        `--use-file-for-fake-video-capture=${FAKE_VIDEO}`,
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
        '--autoplay-policy=no-user-gesture-required',
      ],
    },
  },
};
