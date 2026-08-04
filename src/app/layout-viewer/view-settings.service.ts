import { Injectable, effect, signal } from '@angular/core';

const THUMB3_KEY = 'sirius.view.showThumb3Switch';

/** Shared view options for the layout (used by the viewer and settings dialog). */
@Injectable({ providedIn: 'root' })
export class ViewSettingsService {
  readonly showThumb3Switch = signal<boolean>(localStorage.getItem(THUMB3_KEY) !== 'false');

  constructor() {
    effect(() => localStorage.setItem(THUMB3_KEY, String(this.showThumb3Switch())));
  }

  toggleThumb3Switch(): void {
    this.showThumb3Switch.update((v) => !v);
  }
}
