import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import {
  DirectionMap,
  HighlightKeyCombination,
  KeyLabel,
  KeyLabelType,
  Layer,
} from 'tangent-cc-lib';
import { SwitchSectorComponent } from '../switch-sector/switch-sector.component';
import { SwitchComponent } from './switch.component';

interface State {
  direction: 'cw' | 'ccw';
  rotation: number | undefined;
  highlight: HighlightKeyCombination | null;
  secondary: number[];
  labels: Record<number, KeyLabel[]>;
}

@Component({
  imports: [SwitchComponent],
  template: `<svg>
    <g
      appSwitch
      [center]="{ x: 300, y: 400 }"
      [rotationDirection]="s().direction"
      [rotation]="s().rotation ?? 0"
      [strokeWidth]="3"
      [fontSize]="70"
      [highlightOpacity]="0.7"
      [positionCodeMap]="map"
      [keyLabelMap]="s().labels"
      [highlightKeyCombination]="s().highlight"
      [secondaryHighlightPositions]="s().secondary"
    ></g>
  </svg>`,
})
class HostComponent {
  readonly map: DirectionMap<number> = { n: 1, e: 2, s: 3, w: 4, c: 5 };
  readonly s = signal<State>({
    direction: 'cw',
    rotation: undefined,
    highlight: null,
    secondary: [],
    labels: {},
  });
}

const label = (c: string): KeyLabel =>
  ({
    type: KeyLabelType.String,
    c,
    title: c,
    layer: Layer.Primary,
    shiftKey: false,
    altGraphKey: false,
  }) as unknown as KeyLabel;

const combo = (positionCodes: number[]): HighlightKeyCombination => ({
  layer: Layer.Primary,
  shiftKey: false,
  altGraphKey: false,
  positionCodes,
  score: 0,
  characterKeyPositionCode: 0,
});

describe('SwitchComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const set = (over: Partial<State>) => {
    host.s.update((s) => ({ ...s, ...over }));
    fixture.detectChanges();
  };
  const sectors = () =>
    fixture.debugElement
      .queryAll(By.directive(SwitchSectorComponent))
      .map((d) => d.componentInstance as SwitchSectorComponent);
  const circles = () =>
    Array.from(
      (fixture.nativeElement as SVGElement).querySelectorAll(':scope > g > circle, circle'),
    ).filter(
      (c) =>
        c.parentElement!.hasAttribute('appswitch') || c.parentElement!.hasAttribute('appSwitch'),
    );

  it('has four sectors: north, east, south, west, at 270, 0, 90, 180 degrees', () => {
    expect(sectors().map((s) => s.degree())).toEqual([270, 0, 90, 180]);
    expect(sectors().map((s) => s.positionCode())).toEqual([1, 2, 3, 4]);
  });

  it('gives each sector the center, the look, and the direction', () => {
    set({ direction: 'ccw' });
    for (const s of sectors()) {
      expect(s.center()).toEqual({ x: 300, y: 400 });
      expect(s.strokeWidth()).toBe(3);
      expect(s.fontSize()).toBe(70);
      expect(s.highlightOpacity()).toBe(0.7);
      expect(s.direction()).toBe('ccw');
    }
  });

  it('gives each sector the labels of its own key', () => {
    set({ labels: { 1: [label('N')], 4: [label('W')], 5: [label('C')] } });
    expect(sectors().map((s) => s.keyLabel()?.map((l) => (l as { c: string }).c))).toEqual([
      ['N'],
      undefined as unknown as string[],
      undefined as unknown as string[],
      ['W'],
    ]);
  });

  describe('rotation', () => {
    it('adds to every degree when clockwise', () => {
      set({ rotation: 20 });
      expect(sectors().map((s) => s.degree())).toEqual([290, 20, 110, 200]);
    });

    it('takes away from every degree when counter-clockwise', () => {
      set({ direction: 'ccw', rotation: 20 });
      expect(sectors().map((s) => s.degree())).toEqual([250, -20, 70, 160]);
    });

    it('is zero by default', () => {
      set({ rotation: 0 });
      expect(sectors().map((s) => s.degree())).toEqual([270, 0, 90, 180]);
    });
  });

  describe('the center key', () => {
    const accent = () => circles()[0];
    const pressed = () => circles()[1];

    it('is two circles on the center, 53.68 wide', () => {
      expect(circles().length).toBe(2);
      for (const c of circles()) {
        expect(c.getAttribute('cx')).toBe('300');
        expect(c.getAttribute('cy')).toBe('400');
        expect(c.getAttribute('r')).toBe('53.68');
      }
    });

    it('is invisible at first', () => {
      expect(accent().getAttribute('opacity')).toBe('0');
      expect(pressed().getAttribute('opacity')).toBe('0');
    });

    it('lights the accent when the center key is in the combination', () => {
      set({ highlight: combo([5]) });
      expect(accent().getAttribute('opacity')).toBe('0.7');
      expect(pressed().getAttribute('opacity')).toBe('0');
    });

    it('is not lit by a combination with only the sector keys', () => {
      set({ highlight: combo([1, 2, 3, 4]) });
      expect(accent().getAttribute('opacity')).toBe('0');
    });

    it('lights the pressed color when the center key is held', () => {
      set({ secondary: [5] });
      expect(pressed().getAttribute('opacity')).toBe('0.7');
      expect(accent().getAttribute('opacity')).toBe('0');
    });

    it('lights the sector of a held key, and not the center', () => {
      set({ secondary: [3] });
      expect(pressed().getAttribute('opacity')).toBe('0');
      const pressedPaths = (fixture.nativeElement as SVGElement).querySelectorAll(
        'g[appSwitchSector] > path:nth-of-type(3)',
      );
      expect(Array.from(pressedPaths).map((p) => p.getAttribute('opacity'))).toEqual([
        '0',
        '0',
        '0.7',
        '0',
      ]);
    });

    it('draws its label on the center, when the combination matches', () => {
      set({ highlight: combo([]), labels: { 5: [label('C')] } });
      const text = Array.from((fixture.nativeElement as SVGElement).querySelectorAll('text')).find(
        (t) => t.textContent!.trim() === 'C',
      )!;
      expect(text.getAttribute('x')).toBe('300');
      expect(text.getAttribute('y')).toBe('400');
    });
  });
});
