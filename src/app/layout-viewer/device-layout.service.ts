import { Injectable, computed, effect, signal } from '@angular/core';
import {
  CC1_CC2_LEFT_HAND_ONLY_DEVICE_LAYOUT,
  CC1_CC2_RIGHT_HAND_ONLY_DEVICE_LAYOUT,
  CCLITE_DEFAULT_DEVICE_LAYOUT,
  DEFAULT_DEVICE_LAYOUT,
  DeviceLayout,
  M4G_DEFAULT_DEVICE_LAYOUT,
} from 'tangent-cc-lib';

const UPLOADED_KEY = 'sirius.deviceLayouts.uploaded';
const SELECTED_KEY = 'sirius.deviceLayouts.selectedId';

/** Built-in device layouts shipped by tangent-cc-lib. */
const BUILT_IN_DEVICE_LAYOUTS: DeviceLayout[] = [
  DEFAULT_DEVICE_LAYOUT,
  M4G_DEFAULT_DEVICE_LAYOUT,
  CC1_CC2_RIGHT_HAND_ONLY_DEVICE_LAYOUT,
  CC1_CC2_LEFT_HAND_ONLY_DEVICE_LAYOUT,
  CCLITE_DEFAULT_DEVICE_LAYOUT,
];

/**
 * Holds the available device layouts (built-in + user-uploaded) and the current
 * selection. Replaces Alnitak's NgRx DeviceLayoutStore with plain signals +
 * localStorage persistence.
 */
@Injectable({ providedIn: 'root' })
export class DeviceLayoutService {
  private readonly uploaded = signal<DeviceLayout[]>(readUploaded());
  readonly selectedId = signal<string>(
    localStorage.getItem(SELECTED_KEY) ?? DEFAULT_DEVICE_LAYOUT.id,
  );

  readonly entities = computed<DeviceLayout[]>(() => [
    ...BUILT_IN_DEVICE_LAYOUTS,
    ...this.uploaded(),
  ]);

  readonly selectedEntity = computed<DeviceLayout | null>(
    () => this.entities().find((d) => d.id === this.selectedId()) ?? null,
  );

  readonly selectedEntityLayerNumber = computed<number>(
    () => this.selectedEntity()?.layout.length ?? 0,
  );

  constructor() {
    effect(() => localStorage.setItem(SELECTED_KEY, this.selectedId()));
    effect(() => localStorage.setItem(UPLOADED_KEY, JSON.stringify(this.uploaded())));
  }

  setSelectedId(id: string): void {
    this.selectedId.set(id);
  }

  /** Add uploaded layouts and select the first one. */
  addLayouts(layouts: DeviceLayout[]): void {
    if (!layouts.length) {
      return;
    }
    this.uploaded.update((current) => [...current, ...layouts]);
    this.setSelectedId(layouts[0].id);
  }

  removeUploaded(id: string): void {
    this.uploaded.update((current) => current.filter((d) => d.id !== id));
    if (this.selectedId() === id) {
      this.setSelectedId(DEFAULT_DEVICE_LAYOUT.id);
    }
  }

  isUploaded(id: string): boolean {
    return this.uploaded().some((d) => d.id === id);
  }
}

function readUploaded(): DeviceLayout[] {
  try {
    const raw = localStorage.getItem(UPLOADED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
