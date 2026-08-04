import { Injectable, NgZone, inject, signal } from '@angular/core';
import { WindowControls } from './global-key';

/**
 * Drives the window overlay controls (pin-to-front, passthrough overlay). Under
 * Electron it talks to the main process; in a plain browser the toggles still
 * flip local signals so the passthrough look can be previewed (no OS effect).
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  private readonly zone = inject(NgZone);
  private readonly controls: WindowControls | undefined =
    window.sirius?.windowControls;

  /** True when running under Electron (window effects actually apply). */
  readonly available = signal(Boolean(this.controls));
  /** false = frameless overlay window, true = normal OS frame. */
  readonly framed = signal(false);
  readonly alwaysOnTop = signal(false);
  readonly passthrough = signal(false);
  /** Bumped when the tray menu requests opening Settings. */
  readonly settingsRequested = signal(0);

  constructor() {
    if (this.controls) {
      const sync = (state: {
        framed: boolean;
        alwaysOnTop: boolean;
        passthrough: boolean;
      }) =>
        this.zone.run(() => {
          this.framed.set(state.framed);
          this.alwaysOnTop.set(state.alwaysOnTop);
          this.passthrough.set(state.passthrough);
        });
      this.controls.getState().then(sync);
      // Sync when the main process changes state (e.g. the global shortcut).
      this.controls.onState(sync);
      this.controls.onOpenSettings(() =>
        this.zone.run(() => this.settingsRequested.update((n) => n + 1)),
      );
    } else {
      // Browser preview: no global shortcut, and the toggle button is hidden in
      // passthrough — provide a local Ctrl/Cmd+Shift+O escape hatch.
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyO') {
          e.preventDefault();
          this.togglePassthrough();
        }
      });
    }
  }

  toggleFramed(): void {
    const next = !this.framed();
    this.framed.set(next);
    if (next) {
      // Framed windows can't be a passthrough overlay.
      this.passthrough.set(false);
    }
    this.controls?.setFramed(next);
  }

  toggleAlwaysOnTop(): void {
    const next = !this.alwaysOnTop();
    this.alwaysOnTop.set(next);
    this.controls?.setAlwaysOnTop(next);
  }

  togglePassthrough(): void {
    const next = !this.passthrough();
    this.passthrough.set(next);
    this.controls?.setPassthrough(next);
  }

  /**
   * While passthrough is on, tell the main process whether the cursor is over an
   * interactive control so it can briefly stop click-through for the click.
   */
  setInteractive(interactive: boolean): void {
    this.controls?.setInteractive(interactive);
  }

  /** Move the window by a pixel delta (drag the passthrough overlay). */
  moveBy(dx: number, dy: number): void {
    this.controls?.moveBy(dx, dy);
  }

  minimize(): void {
    this.controls?.minimize();
  }

  close(): void {
    this.controls?.close();
  }
}
