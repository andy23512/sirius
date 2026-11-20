import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { KeyLabel, KeyLabelType, Layer, POSITION_CODE_LAYOUT } from 'tangent-cc-lib';
import { SwitchComponent } from '../switch/switch.component';
import { LayoutComponent } from './layout.component';

describe('LayoutComponent', () => {
  let fixture: ComponentFixture<LayoutComponent>;
  let component: LayoutComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('keyLabelMap', {});
    fixture.detectChanges();
  });

  const set = (name: string, value: unknown) => {
    fixture.componentRef.setInput(name, value);
    fixture.detectChanges();
  };
  const switches = () =>
    fixture.debugElement
      .queryAll(By.directive(SwitchComponent))
      .map((d) => d.componentInstance as SwitchComponent);
  const svg = () => (fixture.nativeElement as HTMLElement).querySelector('svg')!;

  describe('size', () => {
    it('fits 10 cells of 350 with 9 gaps of 35 across, and 5 rows down', () => {
      expect(component.viewBoxWidth).toBe(3815);
      expect(component.gridRows()).toBe(5);
      expect(component.viewBoxHeight()).toBe(1890);
      expect(svg().getAttribute('viewBox')).toBe('0 0 3815 1890');
    });

    it('is one row shorter without the 3rd thumb switch', () => {
      set('showThumb3Switch', false);
      expect(component.gridRows()).toBe(4);
      expect(svg().getAttribute('viewBox')).toBe('0 0 3815 1505');
    });

    it('scales to its container, keeping its shape', () => {
      expect(svg().getAttribute('width')).toBe('100%');
      expect(svg().getAttribute('height')).toBe('100%');
      expect(svg().getAttribute('preserveAspectRatio')).toBe('xMidYMid meet');
    });
  });

  describe('switches', () => {
    it('has nine on each hand, with the 3rd thumb switch', () => {
      expect(component.switches().length).toBe(9);
      expect(switches().length).toBe(18);
      expect(component.switches()).toContain('thumbEnd');
    });

    it('has eight on each hand without it', () => {
      set('showThumb3Switch', false);
      expect(component.switches().length).toBe(8);
      expect(component.switches()).not.toContain('thumbEnd');
      expect(switches().length).toBe(16);
    });

    it('does the left hand first, then the right', () => {
      expect(
        switches()
          .slice(0, 9)
          .every((s) => s.rotationDirection() === 'cw'),
      ).toBeTrue();
      expect(
        switches()
          .slice(9)
          .every((s) => s.rotationDirection() === 'ccw'),
      ).toBeTrue();
    });

    it('gives each switch the position codes of its finger and hand', () => {
      const list = component.switches();
      const sides = ['left', 'right'] as const;
      let i = 0;
      for (const side of sides) {
        for (const sw of list) {
          expect(switches()[i].positionCodeMap()).toEqual(POSITION_CODE_LAYOUT[side][sw]);
          i += 1;
        }
      }
    });

    it('passes the labels and highlights down to every switch', () => {
      const labels: Record<number, KeyLabel[]> = {
        1: [
          {
            type: KeyLabelType.String,
            c: 'x',
            title: 'x',
            layer: Layer.Primary,
            shiftKey: false,
            altGraphKey: false,
          } as unknown as KeyLabel,
        ],
      };
      const combination = {
        layer: Layer.Primary,
        shiftKey: false,
        altGraphKey: false,
        positionCodes: [1],
        score: 0,
        characterKeyPositionCode: 0,
      };
      set('keyLabelMap', labels);
      set('highlightKeyCombination', combination);
      set('secondaryHighlightPositions', [4, 5]);
      for (const s of switches()) {
        expect(s.keyLabelMap()).toBe(labels);
        expect(s.highlightKeyCombination()).toBe(combination);
        expect(s.secondaryHighlightPositions()).toEqual([4, 5]);
      }
    });
  });

  describe('where the switches are', () => {
    // A cell is 350 and a step is 385 (cell + gap); the first center is at 175.
    const left = (sw: Parameters<LayoutComponent['switchCenter']>[0]) =>
      component.switchCenter(sw, 'left');
    const right = (sw: Parameters<LayoutComponent['switchCenter']>[0]) =>
      component.switchCenter(sw, 'right');

    it('puts the fingers in columns, the little finger lowest in the middle of the first two rows', () => {
      expect(left('little')).toEqual({ x: 175, y: 367.5 });
      expect(left('ring')).toEqual({ x: 560, y: 175 });
      expect(left('ringMid')).toEqual({ x: 560, y: 560 });
      expect(left('middle')).toEqual({ x: 945, y: 175 });
      expect(left('middleMid')).toEqual({ x: 945, y: 560 });
      expect(left('index')).toEqual({ x: 1330, y: 367.5 });
    });

    it('steps the thumb switches down and to the left', () => {
      expect(left('thumbTip')).toEqual({ x: 1627.5, y: 945 });
      expect(left('thumbMid')).toEqual({ x: 1540, y: 1330 });
      expect(left('thumbEnd')).toEqual({ x: 1452.5, y: 1715 });
    });

    it('mirrors the right hand across the middle of the picture', () => {
      for (const sw of component.switches()) {
        expect(right(sw).x).toBe(3815 - left(sw).x);
        expect(right(sw).y).toBe(left(sw).y);
      }
    });

    it('does not move one hand when the other is asked for', () => {
      right('little');
      expect(left('little')).toEqual({ x: 175, y: 367.5 });
    });

    it('puts every switch inside the picture, apart from each other', () => {
      const points = (['left', 'right'] as const).flatMap((side) =>
        component.switches().map((sw) => component.switchCenter(sw, side)),
      );
      for (const p of points) {
        expect(p.x).toBeGreaterThanOrEqual(175);
        expect(p.x).toBeLessThanOrEqual(3815 - 175);
        expect(p.y).toBeGreaterThanOrEqual(175);
        expect(p.y).toBeLessThanOrEqual(1890 - 175);
      }
      for (let a = 0; a < points.length; a += 1) {
        for (let b = a + 1; b < points.length; b += 1) {
          const d = Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
          expect(d).withContext(`${a} and ${b}`).toBeGreaterThan(300);
        }
      }
    });

    // Current behavior: a switch that is not known goes to the corner, and
    // is then mirrored for the right hand.
    it('puts an unknown switch at the corner', () => {
      const unknown = 'nope' as Parameters<LayoutComponent['switchCenter']>[0];
      expect(left(unknown)).toEqual({ x: 0, y: 0 });
      expect(right(unknown)).toEqual({ x: 3815, y: 0 });
    });
  });
});
