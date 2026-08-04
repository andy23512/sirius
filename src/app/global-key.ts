/** A normalized global key event forwarded from the Electron main process. */
export interface GlobalKeyEvent {
  /** 'keydown' or 'keyup'. */
  type: 'keydown' | 'keyup';
  /** Raw uiohook keycode (physical key identity). */
  keycode: number;
  /** Human-readable key name derived from the keycode (e.g. "A", "Space"). */
  key: string;
  /** DOM KeyboardEvent.code (e.g. "KeyA", "Space"); null if unmapped. */
  code: string | null;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  /** Event timestamp reported by uiohook (ms). */
  time: number;
}

/** Window overlay state reported by the Electron main process. */
export interface WindowState {
  framed: boolean;
  alwaysOnTop: boolean;
  passthrough: boolean;
}

/** Window overlay controls exposed by the Electron preload script. */
export interface WindowControls {
  getState(): Promise<WindowState>;
  setFramed(on: boolean): void;
  setAlwaysOnTop(on: boolean): void;
  setPassthrough(on: boolean): void;
  setInteractive(on: boolean): void;
  moveBy(dx: number, dy: number): void;
  minimize(): void;
  close(): void;
  onState(callback: (state: WindowState) => void): () => void;
  onOpenSettings(callback: () => void): () => void;
}

/** macOS Accessibility permission status (needed for global key capture). */
export interface AccessibilityStatus {
  /** Whether this platform gates the hook behind a permission (macOS only). */
  needed: boolean;
  granted: boolean;
}

/** Accessibility-permission helpers exposed by the Electron preload script. */
export interface AccessibilityApi {
  getStatus(): Promise<AccessibilityStatus>;
  openSettings(): void;
  onStatus(callback: (status: AccessibilityStatus) => void): () => void;
}

/** API exposed on `window.sirius` by the Electron preload script. */
export interface SiriusApi {
  /**
   * Subscribe to global key events (fires for keystrokes in any application).
   * Returns an unsubscribe function.
   */
  onKey(callback: (event: GlobalKeyEvent) => void): () => void;
  /** Window overlay controls. Present only under Electron. */
  windowControls?: WindowControls;
  /** Accessibility-permission helpers. Present only under Electron. */
  accessibility?: AccessibilityApi;
}

declare global {
  interface Window {
    sirius?: SiriusApi;
  }
}
