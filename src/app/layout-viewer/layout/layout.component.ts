import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import {
  FingerMap,
  HandMap,
  HighlightKeyCombination,
  KeyLabel,
  POSITION_CODE_LAYOUT,
} from 'tangent-cc-lib';
import { SwitchComponent } from '../switch/switch.component';

const cellSize = 350;
const gap = 35;
const gridColumns = 10;

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [SwitchComponent],
  templateUrl: './layout.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutComponent {
  readonly showThumb3Switch = input<boolean>(true);
  readonly keyLabelMap = input<Record<number, KeyLabel[]>>({});
  readonly highlightKeyCombination = input<HighlightKeyCombination | null>(null);
  readonly secondaryHighlightPositions = input<number[]>([]);

  readonly gridRows = computed(() => (this.showThumb3Switch() ? 5 : 4));
  readonly viewBoxWidth = cellSize * gridColumns + gap * (gridColumns - 1);
  readonly viewBoxHeight = computed(() => cellSize * this.gridRows() + gap * (this.gridRows() - 1));

  readonly positionCodeLayout = POSITION_CODE_LAYOUT;
  readonly sides = ['left', 'right'] as const;
  readonly switches = computed(() => {
    if (this.showThumb3Switch()) {
      return [
        'thumbEnd',
        'thumbMid',
        'thumbTip',
        'index',
        'middle',
        'middleMid',
        'ring',
        'ringMid',
        'little',
      ] as const;
    }
    return [
      'thumbMid',
      'thumbTip',
      'index',
      'middle',
      'middleMid',
      'ring',
      'ringMid',
      'little',
    ] as const;
  });

  private gridY(rowIndex: number): number {
    return rowIndex * (cellSize + gap) + cellSize / 2;
  }

  private gridX(columnIndex: number): number {
    return columnIndex * (cellSize + gap) + cellSize / 2;
  }

  switchCenter(
    sw: keyof FingerMap<unknown>,
    side: keyof HandMap<unknown>,
  ): {
    x: number;
    y: number;
  } {
    let position: { x: number; y: number };
    switch (sw) {
      case 'little':
        position = { x: this.gridX(0), y: this.gridY(0.5) };
        break;
      case 'ring':
        position = { x: this.gridX(1), y: this.gridY(0) };
        break;
      case 'ringMid':
        position = { x: this.gridX(1), y: this.gridY(1) };
        break;
      case 'middle':
        position = { x: this.gridX(2), y: this.gridY(0) };
        break;
      case 'middleMid':
        position = { x: this.gridX(2), y: this.gridY(1) };
        break;
      case 'index':
        position = { x: this.gridX(3), y: this.gridY(0.5) };
        break;
      case 'thumbTip':
        position = { x: this.gridX(4) - cellSize / 4, y: this.gridY(2) };
        break;
      case 'thumbMid':
        position = { x: this.gridX(4) - cellSize / 2, y: this.gridY(3) };
        break;
      case 'thumbEnd':
        position = { x: this.gridX(4) - (cellSize * 3) / 4, y: this.gridY(4) };
        break;
      default:
        position = { x: 0, y: 0 };
    }
    if (side === 'right') {
      position.x = this.viewBoxWidth - position.x;
    }
    return position;
  }
}
