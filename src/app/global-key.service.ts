import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { GlobalKeyEvent } from './global-key';

const MAX_EVENTS = 300;

/**
 * Centralizes global key input for the whole app. Prefers the Electron bridge
 * (window.sirius, captures keystrokes in any application). When the bridge is
 * absent (e.g. opened in a plain browser) it falls back to DOM key events, which
 * only fire while this window is focused — still useful for local testing.
 *
 * Exposes a scrolling event log and the set of currently-held DOM codes.
 */
@Injectable({ providedIn: 'root' })
export class GlobalKeyService {
  private readonly zone = inject(NgZone);

  /** True when backed by the Electron bridge (global capture). */
  readonly connected = signal(false);
  /** Most recent key events, newest first. */
  readonly events = signal<GlobalKeyEvent[]>([]);
  /** DOM codes currently held down. */
  readonly pressedCodes = signal<ReadonlySet<string>>(new Set());
  /**
   * The most recent keydown, with a monotonic seq so consumers react even when
   * the same code repeats. null until the first keydown.
   */
  readonly lastKeyDown = signal<{ code: string; seq: number } | null>(null);
  private keyDownSeq = 0;

  /** Whether input is available at all (bridge or DOM fallback). */
  readonly available = computed(() => true);

  constructor() {
    const api = window.sirius;
    if (api) {
      this.connected.set(true);
      api.onKey((event) => this.zone.run(() => this.ingest(event)));
    } else {
      window.addEventListener('keydown', (e) => this.ingestDom('keydown', e));
      window.addEventListener('keyup', (e) => this.ingestDom('keyup', e));
    }
  }

  clear(): void {
    this.events.set([]);
  }

  private ingest(event: GlobalKeyEvent): void {
    this.pushEvent(event);
    this.updatePressed(event.type, event.code);
  }

  private ingestDom(type: 'keydown' | 'keyup', e: KeyboardEvent): void {
    if (e.repeat) {
      return;
    }
    const event: GlobalKeyEvent = {
      type,
      keycode: e.keyCode,
      key: e.code,
      code: e.code,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      metaKey: e.metaKey,
      time: e.timeStamp,
    };
    // DOM events already run inside Angular's zone (zone.js patches them).
    this.ingest(event);
  }

  private pushEvent(event: GlobalKeyEvent): void {
    const next = [event, ...this.events()];
    if (next.length > MAX_EVENTS) {
      next.length = MAX_EVENTS;
    }
    this.events.set(next);
  }

  private updatePressed(type: string, code: string | null): void {
    if (!code) {
      return;
    }
    const next = new Set(this.pressedCodes());
    if (type === 'keydown') {
      next.add(code);
      this.keyDownSeq += 1;
      this.lastKeyDown.set({ code, seq: this.keyDownSeq });
    } else {
      next.delete(code);
    }
    this.pressedCodes.set(next);
  }
}
