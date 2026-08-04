'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Expose a minimal, safe API to the Angular renderer. The renderer never gets
 * direct access to Node or ipcRenderer — only the ability to subscribe to
 * global key events and drive the window overlay controls.
 */
contextBridge.exposeInMainWorld('sirius', {
  /**
   * Subscribe to global key events. Returns an unsubscribe function.
   * @param {(event: object) => void} callback
   * @returns {() => void}
   */
  onKey(callback) {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('global-key', listener);
    return () => ipcRenderer.removeListener('global-key', listener);
  },

  /** Window overlay controls (always-on-top, passthrough, window buttons). */
  windowControls: {
    getState: () => ipcRenderer.invoke('window-get-state'),
    setFramed: (on) => ipcRenderer.send('window-set-framed', on),
    setAlwaysOnTop: (on) => ipcRenderer.send('window-set-always-on-top', on),
    setPassthrough: (on) => ipcRenderer.send('window-set-passthrough', on),
    setInteractive: (on) => ipcRenderer.send('window-set-interactive', on),
    moveBy: (dx, dy) => ipcRenderer.send('window-move-by', dx, dy),
    minimize: () => ipcRenderer.send('window-minimize'),
    close: () => ipcRenderer.send('window-close'),
    /** Subscribe to window-state changes (e.g. from the global shortcut). */
    onState(callback) {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('window-state', listener);
      return () => ipcRenderer.removeListener('window-state', listener);
    },
    /** Fired when the tray menu asks to open Settings. */
    onOpenSettings(callback) {
      const listener = () => callback();
      ipcRenderer.on('menu-open-settings', listener);
      return () => ipcRenderer.removeListener('menu-open-settings', listener);
    },
  },

  /** macOS Accessibility permission (needed for global key capture). */
  accessibility: {
    getStatus: () => ipcRenderer.invoke('accessibility-get-status'),
    openSettings: () => ipcRenderer.send('accessibility-open-settings'),
    onStatus(callback) {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on('accessibility-status', listener);
      return () => ipcRenderer.removeListener('accessibility-status', listener);
    },
  },
});
