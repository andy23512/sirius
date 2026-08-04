import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { AccessibilityApi, AccessibilityStatus } from './global-key';

/**
 * Tracks the macOS Accessibility permission that the global keyboard hook needs.
 * In a plain browser (or on other OSes) the permission isn't applicable, so
 * `blocking` stays false and no banner is shown.
 */
@Injectable({ providedIn: 'root' })
export class AccessibilityService {
  private readonly zone = inject(NgZone);
  private readonly api: AccessibilityApi | undefined = window.sirius?.accessibility;

  private readonly status = signal<AccessibilityStatus>({
    needed: false,
    granted: true,
  });

  /** True when the permission is required but not yet granted. */
  readonly blocking = computed(() => this.status().needed && !this.status().granted);

  constructor() {
    if (this.api) {
      this.api.getStatus().then((status) => this.zone.run(() => this.status.set(status)));
      this.api.onStatus((status) => this.zone.run(() => this.status.set(status)));
    }
  }

  openSettings(): void {
    this.api?.openSettings();
  }
}
