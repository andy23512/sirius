import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AccessibilityService } from './accessibility.service';
import { GlobalKeyEvent } from './global-key';
import { GlobalKeyService } from './global-key.service';
import { LayoutViewerComponent } from './layout-viewer/layout-viewer.component';
import { SettingsDialogComponent } from './settings-dialog/settings-dialog.component';
import { WindowService } from './window.service';

@Component({
  selector: 'app-root',
  imports: [LayoutViewerComponent, SettingsDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly globalKeyService = inject(GlobalKeyService);
  private readonly windowService = inject(WindowService);
  private readonly accessibilityService = inject(AccessibilityService);

  protected readonly connected = this.globalKeyService.connected;
  protected readonly events = this.globalKeyService.events;
  protected readonly accessibilityBlocking = this.accessibilityService.blocking;

  protected readonly framed = this.windowService.framed;
  protected readonly alwaysOnTop = this.windowService.alwaysOnTop;
  protected readonly passthrough = this.windowService.passthrough;
  protected readonly windowControlsAvailable = this.windowService.available;

  /** Show our custom minimize/close only in frameless mode (framed uses the OS). */
  protected readonly showCustomWindowButtons = computed(
    () => this.windowControlsAvailable() && !this.framed(),
  );

  protected readonly settingsOpen = signal(false);

  /** In passthrough the key log is hidden along with the rest of the chrome. */
  protected readonly showChrome = computed(() => !this.passthrough());

  /** The floating overlay controls (drag grip + exit) shown in passthrough mode. */
  private readonly overlayControls =
    viewChild<ElementRef<HTMLElement>>('overlayControls');
  private isDragging = false;

  constructor() {
    // The overlay window is click-through; forward:true still delivers mousemove.
    // When the cursor is over the overlay controls, briefly make the window
    // interactive so clicks/drags land (aqua-sprite's per-pixel technique).
    effect((onCleanup) => {
      if (!this.passthrough() || !this.windowControlsAvailable()) {
        return;
      }
      let over = false;
      const onMove = (e: MouseEvent) => {
        if (this.isDragging) {
          return; // keep the window interactive throughout a drag
        }
        const el = this.overlayControls()?.nativeElement;
        if (!el) {
          return;
        }
        const r = el.getBoundingClientRect();
        const pad = 8;
        const nowOver =
          e.clientX >= r.left - pad &&
          e.clientX <= r.right + pad &&
          e.clientY >= r.top - pad &&
          e.clientY <= r.bottom + pad;
        if (nowOver !== over) {
          over = nowOver;
          this.windowService.setInteractive(nowOver);
        }
      };
      window.addEventListener('mousemove', onMove);
      onCleanup(() => {
        window.removeEventListener('mousemove', onMove);
        this.windowService.setInteractive(false);
      });
    });

    // Open Settings when the tray menu asks for it.
    effect(() => {
      if (this.windowService.settingsRequested() > 0) {
        untracked(() => this.settingsOpen.set(true));
      }
    });
  }

  protected startDrag(event: PointerEvent): void {
    event.preventDefault();
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    this.isDragging = true;
  }

  protected onDrag(event: PointerEvent): void {
    if (!this.isDragging) {
      return;
    }
    if (event.movementX || event.movementY) {
      this.windowService.moveBy(event.movementX, event.movementY);
    }
  }

  protected endDrag(event: PointerEvent): void {
    this.isDragging = false;
    (event.target as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  protected openSettings(): void {
    this.settingsOpen.set(true);
  }

  protected closeSettings(): void {
    this.settingsOpen.set(false);
  }

  protected toggleFramed(): void {
    this.windowService.toggleFramed();
  }

  protected togglePin(): void {
    this.windowService.toggleAlwaysOnTop();
  }

  protected togglePassthrough(): void {
    // Leaving settings open under a transparent, click-through window is odd.
    this.settingsOpen.set(false);
    this.windowService.togglePassthrough();
  }

  protected openAccessibilitySettings(): void {
    this.accessibilityService.openSettings();
  }

  protected minimize(): void {
    this.windowService.minimize();
  }

  protected close(): void {
    this.windowService.close();
  }

  protected clear(): void {
    this.globalKeyService.clear();
  }

  protected modifiers(event: GlobalKeyEvent): string {
    const active: string[] = [];
    if (event.ctrlKey) active.push('Ctrl');
    if (event.altKey) active.push('Alt');
    if (event.shiftKey) active.push('Shift');
    if (event.metaKey) active.push('Meta');
    return active.join(' + ');
  }
}
