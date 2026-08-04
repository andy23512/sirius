'use strict';

const path = require('node:path');
const zlib = require('node:zlib');
const fs = require('node:fs');
const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  systemPreferences,
  shell,
  screen,
} = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const isDev = process.env.NODE_ENV === 'development';

// Window overlay state.
const windowState = {
  framed: false, // false = frameless+transparent (overlay-capable); true = normal OS frame
  alwaysOnTop: false,
  passthrough: false,
};

// --- Persisted state (window bounds + framed/pin), stored in userData ---
// passthrough is intentionally NOT persisted — never launch into a hidden,
// click-through overlay.
let persisted = {};
let saveTimer = null;

function stateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}
function loadPersisted() {
  try {
    return JSON.parse(fs.readFileSync(stateFilePath(), 'utf8')) || {};
  } catch {
    return {};
  }
}
function savePersisted() {
  const bounds =
    mainWindow && !mainWindow.isDestroyed() ? mainWindow.getBounds() : persisted.bounds;
  persisted = { bounds, framed: windowState.framed, alwaysOnTop: windowState.alwaysOnTop };
  try {
    fs.writeFileSync(stateFilePath(), JSON.stringify(persisted));
  } catch {
    // Best-effort; ignore write failures.
  }
}
function savePersistedDebounced() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(savePersisted, 500);
}

/** Saved bounds if still visible on some display, else sensible defaults. */
function getWindowBounds() {
  const def = { width: 960, height: 700 };
  const b = persisted.bounds;
  if (!b || typeof b.width !== 'number' || typeof b.x !== 'number') {
    return def;
  }
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      b.x < a.x + a.width && b.x + b.width > a.x && b.y < a.y + a.height && b.y + b.height > a.y
    );
  });
  return onScreen ? b : def;
}

// Build a reverse lookup: keycode -> human-readable name (e.g. 30 -> "A").
const keycodeToName = Object.create(null);
for (const [name, code] of Object.entries(UiohookKey)) {
  // Keep the first name we see for a given code (UiohookKey has a few aliases).
  if (!(code in keycodeToName)) {
    keycodeToName[code] = name;
  }
}

/**
 * Convert a UiohookKey name into a DOM KeyboardEvent.code string, which is what
 * tangent-cc-lib uses for a device layout's key codes (WSKCode / NonWSKCode).
 * This lets the renderer map a physical keystroke back to a layout position,
 * independent of the OS keyboard layout.
 */
function nameToCode(name) {
  if (/^[0-9]$/.test(name)) return 'Digit' + name;
  if (/^[A-Z]$/.test(name)) return 'Key' + name;
  switch (name) {
    case 'Alt':
      return 'AltLeft';
    case 'CtrlRight':
      return 'ControlRight';
    case 'Ctrl':
      return 'ControlLeft';
    case 'Meta':
      return 'MetaLeft';
    case 'Shift':
      return 'ShiftLeft';
    // ArrowUp/Down/Left/Right, punctuation, Backspace, Enter, Tab, Escape,
    // Space, F1..F24, Numpad*, ShiftRight, AltRight, MetaRight already match.
    default:
      return name;
  }
}

// keycode -> DOM code.
const keycodeToCode = Object.create(null);
for (const [name, code] of Object.entries(UiohookKey)) {
  if (!(code in keycodeToCode)) {
    keycodeToCode[code] = nameToCode(name);
  }
}

/** @type {BrowserWindow | null} */
let mainWindow = null;

function createWindow() {
  const framed = windowState.framed;
  const bounds = getWindowBounds();
  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    ...(typeof bounds.x === 'number' ? { x: bounds.x, y: bounds.y } : {}),
    title: 'Sirius',
    // Frameless mode is transparent so the renderer can paint an opaque
    // background normally and go fully transparent (only the layout floats) in
    // passthrough. `frame`/`transparent` can't be toggled after creation, so
    // switching back to the normal OS frame recreates the window.
    frame: framed,
    transparent: !framed,
    hasShadow: framed,
    backgroundColor: framed ? '#0a0e20' : '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'sirius', 'browser', 'index.html'));
  }

  // Re-apply overlay state after (re)load — matters when recreating the window.
  mainWindow.webContents.once('did-finish-load', () => {
    if (windowState.alwaysOnTop) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
    if (windowState.passthrough && !windowState.framed) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }
    sendToRenderer('window-state', { ...windowState });
    sendToRenderer('accessibility-status', accessibilityStatus());
  });

  // Persist position/size as the user moves/resizes the window.
  mainWindow.on('move', savePersistedDebounced);
  mainWindow.on('resize', savePersistedDebounced);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/** Switch between the normal OS frame and the frameless overlay window. */
function applyFramed(framed) {
  framed = Boolean(framed);
  if (windowState.framed === framed) {
    return;
  }
  windowState.framed = framed;
  if (framed) {
    // A framed window can't be transparent, so it can't be a passthrough overlay.
    windowState.passthrough = false;
  }
  const old = mainWindow;
  const bounds = old && !old.isDestroyed() ? old.getBounds() : null;
  if (old) {
    // Prevent the old window's 'closed' handler from nulling the new mainWindow.
    old.removeAllListeners('closed');
  }
  createWindow();
  if (bounds) {
    mainWindow.setBounds(bounds);
  }
  if (old && !old.isDestroyed()) {
    old.destroy();
  }
  updateTrayMenu();
  savePersisted();
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function applyAlwaysOnTop(on) {
  windowState.alwaysOnTop = Boolean(on);
  if (mainWindow && !mainWindow.isDestroyed()) {
    // 'screen-saver' level floats above full-screen apps too.
    mainWindow.setAlwaysOnTop(windowState.alwaysOnTop, 'screen-saver');
  }
  sendToRenderer('window-state', { ...windowState });
  updateTrayMenu();
  savePersisted();
}

// Track whether passthrough auto-enabled pin, so we can restore on exit.
let autoPinnedForPassthrough = false;

function applyPassthrough(on) {
  // Passthrough needs a transparent (frameless) window.
  const next = windowState.framed ? false : Boolean(on);
  windowState.passthrough = next;
  if (mainWindow && !mainWindow.isDestroyed()) {
    // forward:true keeps move events flowing so a global shortcut can restore it.
    mainWindow.setIgnoreMouseEvents(next, { forward: true });
  }
  // Auto-pin so the overlay floats above other windows; restore on exit.
  if (next && !windowState.alwaysOnTop) {
    autoPinnedForPassthrough = true;
    applyAlwaysOnTop(true);
  } else if (!next && autoPinnedForPassthrough) {
    autoPinnedForPassthrough = false;
    applyAlwaysOnTop(false);
  }
  sendToRenderer('window-state', { ...windowState });
  updateTrayMenu();
}

// --- macOS Accessibility permission (needed for the global keyboard hook) ---
let accessibilityPoll = null;

function accessibilityStatus() {
  if (process.platform !== 'darwin') {
    // Only macOS gates the low-level keyboard hook behind a permission.
    return { needed: false, granted: true };
  }
  return {
    needed: true,
    granted: systemPreferences.isTrustedAccessibilityClient(false),
  };
}

function openAccessibilitySettings() {
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  );
}

/** Poll for the permission while it's missing so the UI banner can auto-clear. */
function watchAccessibility() {
  if (process.platform !== 'darwin' || accessibilityPoll) {
    return;
  }
  if (systemPreferences.isTrustedAccessibilityClient(false)) {
    return;
  }
  accessibilityPoll = setInterval(() => {
    if (systemPreferences.isTrustedAccessibilityClient(false)) {
      clearInterval(accessibilityPoll);
      accessibilityPoll = null;
      sendToRenderer('accessibility-status', accessibilityStatus());
    }
  }, 2000);
}

// --- Tray icon + menu ---
let tray = null;

/** CRC32 (for the hand-built PNG below). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Rasterize a monochrome 5-pointed star into a template PNG for the tray. */
function makeStarIcon() {
  const size = 44;
  const cx = size / 2;
  const cy = size / 2;
  const outer = size * 0.46;
  const inner = outer * 0.42;
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  const inside = (px, py) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
      const [xi, yi] = pts[i];
      const [xj, yj] = pts[j];
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
        hit = !hit;
      }
    }
    return hit;
  };
  const rgba = Buffer.alloc(size * size * 4, 0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (inside(x + 0.5, y + 0.5)) {
        const o = (y * size + x) * 4;
        rgba[o + 3] = 255; // black (0,0,0) + opaque
      }
    }
  }
  const icon = nativeImage
    .createFromBuffer(encodePng(size, size, rgba))
    .resize({ width: 18, height: 18 });
  if (process.platform === 'darwin') {
    icon.setTemplateImage(true); // tint for light/dark menu bar
  }
  return icon;
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

function toggleWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    showWindow();
  }
}

function openSettingsFromTray() {
  // Leaving passthrough makes the window interactive so the dialog is usable.
  applyPassthrough(false);
  showWindow();
  sendToRenderer('menu-open-settings');
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Sirius', enabled: false },
    { type: 'separator' },
    { label: 'Settings…', click: openSettingsFromTray },
    {
      label: 'Pin to front',
      type: 'checkbox',
      checked: windowState.alwaysOnTop,
      click: () => applyAlwaysOnTop(!windowState.alwaysOnTop),
    },
    {
      label: 'Passthrough overlay',
      type: 'checkbox',
      checked: windowState.passthrough,
      enabled: !windowState.framed,
      click: () => applyPassthrough(!windowState.passthrough),
    },
    {
      label: 'Window frame',
      type: 'checkbox',
      checked: windowState.framed,
      click: () => applyFramed(!windowState.framed),
    },
    { type: 'separator' },
    { label: 'Show window', click: showWindow },
    { label: 'Quit Sirius', role: 'quit' },
  ]);
}

function updateTrayMenu() {
  // On macOS/Windows the menu is built fresh on right-click (always in sync), so
  // this only maintains the persistent context menu used on Linux.
  if (tray && !tray.isDestroyed() && process.platform === 'linux') {
    tray.setContextMenu(buildTrayMenu());
  }
}

function createTray() {
  if (tray) {
    return;
  }
  tray = new Tray(makeStarIcon());
  tray.setToolTip('Sirius');
  if (process.platform === 'linux') {
    // Linux tray click events are unreliable; show the menu on click instead.
    tray.setContextMenu(buildTrayMenu());
  } else {
    // Left-click toggles the window; right-click opens the menu.
    tray.on('click', () => toggleWindow());
    tray.on('right-click', () => tray.popUpContextMenu(buildTrayMenu()));
  }
}

/**
 * Normalize a raw uiohook keyboard event into a serializable shape and forward
 * it to the renderer + stdout. This fires for keystrokes in ANY application,
 * not just this window.
 */
function handleKey(type, event) {
  const info = {
    type, // 'keydown' | 'keyup'
    keycode: event.keycode,
    key: keycodeToName[event.keycode] ?? `Unknown(${event.keycode})`,
    code: keycodeToCode[event.keycode] ?? null,
    shiftKey: Boolean(event.shiftKey),
    ctrlKey: Boolean(event.ctrlKey),
    altKey: Boolean(event.altKey),
    metaKey: Boolean(event.metaKey),
    time: event.time,
  };

  // Print the obtainable info (character/name and code) to the main-process console.
  console.log(
    `[${info.type}] key=${info.key} keycode=${info.keycode}` +
      ` mods={shift:${info.shiftKey}, ctrl:${info.ctrlKey}, alt:${info.altKey}, meta:${info.metaKey}}`,
  );

  sendToRenderer('global-key', info);
}

function startHook() {
  uIOhook.on('keydown', (event) => handleKey('keydown', event));
  uIOhook.on('keyup', (event) => handleKey('keyup', event));
  uIOhook.start();
}

function stopHook() {
  try {
    uIOhook.stop();
  } catch {
    // Already stopped / never started.
  }
}

// --- Window control IPC (from the renderer buttons) ---
ipcMain.handle('window-get-state', () => ({ ...windowState }));
ipcMain.on('window-set-framed', (_e, on) => applyFramed(on));
ipcMain.on('window-set-always-on-top', (_e, on) => applyAlwaysOnTop(on));
ipcMain.on('window-set-passthrough', (_e, on) => applyPassthrough(on));
// While passthrough is on, the renderer reports when the cursor is over an
// interactive control (e.g. the exit button) so we can briefly stop ignoring
// mouse events and let the click land.
ipcMain.on('window-set-interactive', (_e, interactive) => {
  if (windowState.passthrough && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  }
});
// Move the window by a delta (used to drag the passthrough overlay by its grip).
ipcMain.on('window-move-by', (_e, dx, dy) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
  }
});
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-close', () => mainWindow?.close());
ipcMain.handle('accessibility-get-status', () => accessibilityStatus());
ipcMain.on('accessibility-open-settings', () => openAccessibilitySettings());

app.whenReady().then(() => {
  // Restore persisted window state (bounds + framed + pin). passthrough is never
  // restored.
  persisted = loadPersisted();
  windowState.framed = Boolean(persisted.framed);
  windowState.alwaysOnTop = Boolean(persisted.alwaysOnTop);

  createWindow();
  createTray();
  startHook();
  watchAccessibility();

  // Exit (or toggle) passthrough via a global shortcut, since the UI is
  // click-through and hidden while passthrough is on.
  globalShortcut.register('CommandOrControl+Shift+O', () => {
    applyPassthrough(!windowState.passthrough);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopHook();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  savePersisted();
  stopHook();
  globalShortcut.unregisterAll();
  if (accessibilityPoll) {
    clearInterval(accessibilityPoll);
    accessibilityPoll = null;
  }
});
