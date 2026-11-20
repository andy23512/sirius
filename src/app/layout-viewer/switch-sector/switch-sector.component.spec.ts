import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { HighlightKeyCombination, KeyLabel, KeyLabelType, Layer } from 'tangent-cc-lib';
import { SwitchSectorComponent } from './switch-sector.component';

interface State {
  direction: 'cw' | 'ccw';
  degree: number;
  strokeWidth: number;
  highlight: HighlightKeyCombination | null;
  secondary: number[];
  opacity: number;
  labels: KeyLabel[];
}

@Component({
  imports: [SwitchSectorComponent],
  template: `<svg>
    <g
      appSwitchSector
      [center]="{ x: 100, y: 200 }"
      [direction]="s().direction"
      [degree]="s().degree"
      [strokeWidth]="s().strokeWidth"
      [positionCode]="7"
      [highlightKeyCombination]="s().highlight"
      [secondaryHighlightPositions]="s().secondary"
      [highlightOpacity]="s().opacity"
      [keyLabel]="s().labels"
    ></g>
  </svg>`,
})
class HostComponent {
  readonly s = signal<State>({
    direction: 'cw',
    degree: 270,
    strokeWidth: 2,
    highlight: null,
    secondary: [],
    opacity: 0.5,
    labels: [],
  });
}

const combo = (positionCodes: number[]): HighlightKeyCombination => ({
  layer: Layer.Primary,
  shiftKey: false,
  altGraphKey: false,
  positionCodes,
  score: 0,
  characterKeyPositionCode: 0,
});

describe('SwitchSectorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let sector: SwitchSectorComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    sector = fixture.debugElement.query(By.directive(SwitchSectorComponent)).componentInstance;
  });

  const set = (over: Partial<State>) => {
    host.s.update((s) => ({ ...s, ...over }));
    fixture.detectChanges();
  };
  const paths = () => Array.from((fixture.nativeElement as SVGElement).querySelectorAll('path'));
  const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);

  describe('geometry', () => {
    it('has an inner radius of 65, and an outer one that leaves room for the line', () => {
      expect(sector.r1()).toBe(65);
      expect(sector.r2()).toBe(173);
      set({ strokeWidth: 5 });
      expect(sector.r2()).toBe(170);
    });

    it('keeps a small gap between sectors, a bit more at the inner arc', () => {
      expect(sector.alpha1()).toBeGreaterThan(sector.alpha2());
      expect(sector.alpha1()).toBeCloseTo((Math.asin((4 * Math.SQRT2) / 65) * 180) / Math.PI, 10);
      expect(sector.alpha2()).toBeCloseTo((Math.asin((4 * Math.SQRT2) / 173) * 180) / Math.PI, 10);
    });

    it('puts the label in the middle of the band, along the sector direction', () => {
      expect(sector.textRadius).toBe(120);
      set({ degree: 0 });
      expect(sector.textX()).toBeCloseTo(220, 8);
      expect(sector.textY()).toBeCloseTo(200, 8);
      set({ degree: 90 });
      expect(sector.textX()).toBeCloseTo(100, 8);
      expect(sector.textY()).toBeCloseTo(320, 8);
      set({ degree: 270 });
      expect(sector.textY()).toBeCloseTo(80, 8);
    });
  });

  describe('the outline path', () => {
    it('starts on the inner arc and draws four parts for a clockwise sector', () => {
      const d = sector.sectorPath().trim();
      expect(d.startsWith('M')).toBeTrue();
      expect(d.match(/[MALZ]/g)).toEqual(['M', 'A', 'L', 'A']);
      expect(d).toContain('A 65 65 0 0 1');
      expect(d).toContain('A 173 173 0 0 0');
    });

    it('turns the arcs the other way for a counter-clockwise sector', () => {
      set({ direction: 'ccw' });
      const d = sector.sectorPath();
      expect(d).toContain('A 65 65 0 0 0');
      expect(d).toContain('A 173 173 0 0 1');
    });

    it('has its points on the inner and outer circles', () => {
      for (const direction of ['cw', 'ccw'] as const) {
        set({ direction, degree: 123 });
        const n = numbers(sector.sectorPath());
        // numbers: M x y, A r r 0 0 f x y, L x y, A r r 0 0 f x y
        const pts = [
          [n[0], n[1]],
          [n[7], n[8]],
          [n[9], n[10]],
          [n[16], n[17]],
        ];
        const radii = pts.map(([x, y]) => Math.hypot(x - 100, y - 200));
        expect(radii[0]).toBeCloseTo(65, 6);
        expect(radii[1]).toBeCloseTo(65, 6);
        expect(radii[2]).toBeCloseTo(173, 6);
        expect(radii[3]).toBeCloseTo(173, 6);
      }
    });

    it('is 90 degrees minus the gaps wide, centered on the sector degree', () => {
      set({ degree: 0 });
      const n = numbers(sector.sectorPath());
      const angle = (x: number, y: number) => (Math.atan2(y - 200, x - 100) * 180) / Math.PI;
      const start = angle(n[0], n[1]);
      const end = angle(n[7], n[8]);
      expect(end - start).toBeCloseTo(90 - 2 * sector.alpha1(), 6);
      expect((start + end) / 2).toBeCloseTo(0, 6);
    });

    it('is drawn as a white line with no fill, as wide as the stroke', () => {
      const [outline] = paths();
      expect(outline.getAttribute('stroke')).toBe('#ffffff');
      expect(outline.getAttribute('fill')).toBe('transparent');
      expect(outline.getAttribute('stroke-width')).toBe('2');
      set({ strokeWidth: 4 });
      expect(paths()[0].getAttribute('stroke-width')).toBe('4');
    });

    it('is closed for the two highlight fills', () => {
      expect(paths()[1].getAttribute('d')!.trim().endsWith('Z')).toBeTrue();
      expect(paths()[2].getAttribute('d')!.trim().endsWith('Z')).toBeTrue();
    });
  });

  describe('highlights', () => {
    const accent = () => paths()[1].getAttribute('opacity');
    const pressed = () => paths()[2].getAttribute('opacity');

    it('are invisible at first', () => {
      expect(accent()).toBe('0');
      expect(pressed()).toBe('0');
    });

    it('shows the accent when the key is part of the highlighted combination', () => {
      set({ highlight: combo([3, 7]) });
      expect(accent()).toBe('0.5');
      expect(pressed()).toBe('0');
    });

    it('does not show the accent for another key', () => {
      set({ highlight: combo([3, 8]) });
      expect(accent()).toBe('0');
    });

    it('shows the pressed color when the key is held', () => {
      set({ secondary: [1, 7] });
      expect(pressed()).toBe('0.5');
      expect(accent()).toBe('0');
    });

    it('can show both at once', () => {
      set({ highlight: combo([7]), secondary: [7] });
      expect(accent()).toBe('0.5');
      expect(pressed()).toBe('0.5');
    });

    it('uses the opacity it is given', () => {
      set({ highlight: combo([7]), secondary: [7], opacity: 0.8 });
      expect(accent()).toBe('0.8');
      expect(pressed()).toBe('0.8');
    });

    it('takes its colors from CSS variables', () => {
      expect(paths()[1].getAttribute('style')).toContain('var(--sirius-accent)');
      expect(paths()[2].getAttribute('style')).toContain('var(--sirius-pressed)');
    });
  });

  describe('the label', () => {
    it('is drawn at the label position, when the combination matches', () => {
      set({
        degree: 0,
        highlight: combo([]),
        labels: [
          {
            type: KeyLabelType.String,
            c: 'q',
            title: 'q',
            layer: Layer.Primary,
            shiftKey: false,
            altGraphKey: false,
          } as unknown as KeyLabel,
        ],
      });
      const text = (fixture.nativeElement as SVGElement).querySelector('text')!;
      expect(text.textContent!.trim()).toBe('q');
      expect(Number(text.getAttribute('x'))).toBeCloseTo(220, 8);
      expect(Number(text.getAttribute('y'))).toBeCloseTo(200, 8);
    });

    it('is not drawn without a highlighted combination', () => {
      expect((fixture.nativeElement as SVGElement).querySelector('text')).toBeNull();
    });
  });
});
