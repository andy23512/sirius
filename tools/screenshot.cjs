// Capture a README screenshot of the built renderer (no Electron bridge, so it
// runs in the DOM-fallback mode). Lights a few keys to show the highlighting.
//
// Run: npm run build && npx electron tools/screenshot.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 720,
    show: false,
    backgroundColor: '#0a0e20',
  });
  await win.loadFile(path.join(__dirname, '..', 'dist', 'sirius', 'browser', 'index.html'));
  await wait(1500); // let the layout + fonts render

  // Light a couple of keys via the DOM fallback to show the highlighting.
  await win.webContents.executeJavaScript(
    `['KeyE', 'KeyT', 'Space'].forEach((code) =>
       window.dispatchEvent(new KeyboardEvent('keydown', { code })));`,
  );
  await wait(400);

  const image = await win.webContents.capturePage();
  const outDir = path.join(__dirname, '..', 'docs');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'screenshot.png'), image.toPNG());
  console.log('wrote docs/screenshot.png');
  app.quit();
});
