import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { HighlightKeyCombination, Layer } from 'tangent-cc-lib';
import { GlobalKeyService } from '../global-key.service';
import {
  buildCodeToLayers,
  buildCodeToPositions,
  liveModifiers,
  pressedPositions,
} from './code-to-positions';
import { DeviceLayoutService } from './device-layout.service';
import { buildKeyLabelMap, getHighlightPositionCodes } from './key-label-map';
import { KeyboardLayoutService } from './keyboard-layout.service';
import { LayoutComponent } from './layout/layout.component';
import { getOperatingSystem } from './operating-system';
import { ViewSettingsService } from './view-settings.service';

@Component({
  selector: 'app-layout-viewer',
  standalone: true,
  imports: [LayoutComponent],
  templateUrl: './layout-viewer.component.html',
  styleUrl: './layout-viewer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutViewerComponent {
  /** Hide all chrome (toolbar/legend) — used in passthrough overlay mode. */
  readonly overlay = input<boolean>(false);

  private readonly deviceLayoutService = inject(DeviceLayoutService);
  private readonly keyboardLayoutService = inject(KeyboardLayoutService);
  private readonly globalKeyService = inject(GlobalKeyService);
  private readonly viewSettings = inject(ViewSettingsService);
  private readonly operatingSystem = getOperatingSystem();

  readonly Layer = Layer;

  private readonly deviceLayout = this.deviceLayoutService.selectedEntity;
  private readonly deviceLayoutLayerNumber = this.deviceLayoutService.selectedEntityLayerNumber;
  private readonly keyboardLayout = this.keyboardLayoutService.selectedEntity;
  readonly hasDeadKey = this.keyboardLayoutService.hasDeadKey;
  readonly showThumb3Switch = this.viewSettings.showThumb3Switch;

  // Layer / modifier state. shiftManual/altGraphManual are the toggle buttons;
  // the effective shiftKey/altGraphKey also follow the live held modifiers, so
  // holding Shift on the device switches the view to the Shift variant.
  readonly currentLayer = signal<Layer>(Layer.Primary);
  private readonly shiftManual = signal(false);
  private readonly altGraphManual = signal(false);
  private readonly liveMods = computed(() => liveModifiers(this.globalKeyService.pressedCodes()));
  readonly shiftKey = computed(() => this.shiftManual() || this.liveMods().shift);
  readonly altGraphKey = computed(() => this.altGraphManual() || this.liveMods().altGraph);

  readonly layers = computed<Layer[]>(() =>
    [Layer.Primary, Layer.Secondary, Layer.Tertiary, Layer.Quaternary].slice(
      0,
      this.deviceLayoutLayerNumber(),
    ),
  );

  readonly keyLabelMap = computed(() =>
    buildKeyLabelMap(this.deviceLayout(), this.keyboardLayout(), this.operatingSystem),
  );

  readonly highlightKeyCombination = computed<HighlightKeyCombination>(() => ({
    positionCodes: getHighlightPositionCodes(
      this.deviceLayout(),
      this.currentLayer(),
      this.shiftKey(),
      this.altGraphKey(),
    ),
    score: 0,
    characterKeyPositionCode: 0,
    layer: this.currentLayer(),
    shiftKey: this.shiftKey(),
    altGraphKey: this.altGraphKey(),
  }));

  readonly profilePrefix = computed(() => this.deviceLayout()?.profile ?? 'A');

  // Live key highlighting: map held DOM codes to layout positions.
  private readonly codeToPositions = computed(() => buildCodeToPositions(this.deviceLayout()));
  private readonly codeToLayers = computed(() => buildCodeToLayers(this.deviceLayout()));
  readonly pressedPositions = computed(() =>
    pressedPositions(this.codeToPositions(), this.globalKeyService.pressedCodes()),
  );

  constructor() {
    // Keep the selected layer valid when the device layout changes to one with
    // fewer layers (e.g. switching from a 4-layer to a 3-layer device layout) —
    // otherwise currentLayer keeps pointing at a layer that no longer exists
    // and every layer-specific key label stops rendering.
    effect(() => {
      const layers = this.layers();
      untracked(() => {
        if (!layers.includes(this.currentLayer())) {
          this.currentLayer.set(layers[0] ?? Layer.Primary);
        }
      });
    });

    // Follow typing: when a pressed key isn't on the current layer, switch to a
    // layer that produces it (e.g. a number that only lives on the 2nd layer).
    effect(() => {
      const last = this.globalKeyService.lastKeyDown();
      if (!last) {
        return;
      }
      untracked(() => {
        const layers = this.codeToLayers()[last.code];
        if (!layers?.length || layers.includes(this.currentLayer())) {
          return;
        }
        this.currentLayer.set(layers[0]);
      });
    });
  }

  setLayer(layer: Layer): void {
    this.currentLayer.set(layer);
  }

  toggleShift(): void {
    this.shiftManual.update((v) => !v);
  }

  toggleAltGraph(): void {
    this.altGraphManual.update((v) => !v);
  }
}
