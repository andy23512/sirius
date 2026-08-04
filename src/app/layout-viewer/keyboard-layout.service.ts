import { Injectable, computed, effect, signal } from '@angular/core';
import {
  CHINESE_KEYBOARD_LAYOUTS,
  KEYBOARD_LAYOUTS_FROM_KBDLAYOUT,
  KEYBOARD_LAYOUTS_FROM_XKEYBOARD,
  KeyboardLayout,
} from 'tangent-cc-lib';

const SELECTED_KEY = 'sirius.keyboardLayout.selectedId';
const DEFAULT_ID = 'us';

/** All available OS keyboard layouts (Windows kbdlayout + Linux xkb + Chinese). */
const KEYBOARD_LAYOUTS: KeyboardLayout[] = [
  ...KEYBOARD_LAYOUTS_FROM_KBDLAYOUT,
  ...KEYBOARD_LAYOUTS_FROM_XKEYBOARD,
  ...CHINESE_KEYBOARD_LAYOUTS,
];

/**
 * Holds the available OS keyboard layouts and the current selection. Replaces
 * Alnitak's LayoutViewerKeyboardLayoutStore.
 */
@Injectable({ providedIn: 'root' })
export class KeyboardLayoutService {
  readonly entities = KEYBOARD_LAYOUTS;
  readonly selectedId = signal<string>(localStorage.getItem(SELECTED_KEY) ?? DEFAULT_ID);

  readonly selectedEntity = computed<KeyboardLayout | null>(
    () => this.entities.find((k) => k.id === this.selectedId()) ?? null,
  );

  readonly hasDeadKey = computed<boolean>(() => {
    const layout = this.selectedEntity()?.layout;
    if (!layout) {
      return false;
    }
    return Object.values(layout).some((key) =>
      Object.values(key ?? {}).some((output) => output?.type === 'dead-key'),
    );
  });

  constructor() {
    effect(() => localStorage.setItem(SELECTED_KEY, this.selectedId()));
  }

  setSelectedId(id: string): void {
    this.selectedId.set(id);
  }

  reset(): void {
    this.setSelectedId(DEFAULT_ID);
  }

  get defaultId(): string {
    return DEFAULT_ID;
  }
}
