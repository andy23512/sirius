import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HighlightKeyCombination, KeyLabel } from 'tangent-cc-lib';
import { cos, sin } from '../math.utils';
import { KeyLabelComponent } from '../key-label/key-label.component';

const o = 8;
const R1 = 65;
const R2 = 175;

@Component({
  selector: '[appSwitchSector]',
  standalone: true,
  imports: [KeyLabelComponent],
  templateUrl: './switch-sector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwitchSectorComponent {
  readonly center = input.required<{ x: number; y: number }>();
  readonly strokeWidth = input<number>(1);
  readonly direction = input.required<'cw' | 'ccw'>();
  readonly degree = input.required<number>();
  readonly positionCode = input.required<number>();
  readonly fontSize = input<number>(80);
  readonly keyLabel = input<KeyLabel[]>([]);
  readonly highlightKeyCombination = input<HighlightKeyCombination | null>(null);
  readonly highlightOpacity = input<number>(0.5);
  readonly secondaryHighlightPositions = input<number[]>([]);

  readonly r1 = computed(() => R1);
  readonly r2 = computed(() => R2 - this.strokeWidth());

  readonly alpha1 = computed(
    () => (Math.asin(((o / 2) * Math.SQRT2) / this.r1()) / Math.PI) * 180,
  );
  readonly alpha2 = computed(
    () => (Math.asin(((o / 2) * Math.SQRT2) / this.r2()) / Math.PI) * 180,
  );

  readonly sectorPath = computed(() => {
    const center = this.center();
    const direction = this.direction();
    const d = this.degree();
    const cx = center.x;
    const cy = center.y;
    const dStart = d - 45;
    const dEnd = d + 45;
    const alpha1 = this.alpha1();
    const alpha2 = this.alpha2();
    const beta1Start = dStart + alpha1;
    const beta1End = dEnd - alpha1;
    const beta2Start = dStart + alpha2;
    const beta2End = dEnd - alpha2;
    const r1 = this.r1();
    const r2 = this.r2();
    if (direction === 'cw') {
      return `
        M ${cx + r1 * cos(beta1Start)} ${cy + r1 * sin(beta1Start)}
        A ${r1} ${r1} 0 0 1 ${cx + r1 * cos(beta1End)} ${cy + r1 * sin(beta1End)}
        L ${cx + r2 * cos(beta2End)} ${cy + r2 * sin(beta2End)}
        A ${r2} ${r2} 0 0 0 ${cx + r2 * cos(beta2Start)} ${cy + r2 * sin(beta2Start)}
      `;
    }
    return `
      M ${cx + r1 * cos(beta1End)} ${cy + r1 * sin(beta1End)}
      A ${r1} ${r1} 0 0 0 ${cx + r1 * cos(beta1Start)} ${cy + r1 * sin(beta1Start)}
      L ${cx + r2 * cos(beta2Start)} ${cy + r2 * sin(beta2Start)}
      A ${r2} ${r2} 0 0 1 ${cx + r2 * cos(beta2End)} ${cy + r2 * sin(beta2End)}
    `;
  });

  readonly textRadius = (R1 + R2) / 2;

  readonly textX = computed(() => this.center().x + this.textRadius * cos(this.degree()));
  readonly textY = computed(() => this.center().y + this.textRadius * sin(this.degree()));
}
