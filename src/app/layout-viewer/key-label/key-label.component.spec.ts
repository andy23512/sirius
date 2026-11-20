import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HighlightKeyCombination, KeyLabel, KeyLabelType, Layer } from 'tangent-cc-lib';
import { KeyLabelComponent } from './key-label.component';

@Component({
  imports: [KeyLabelComponent],
  template: `<svg>
    <g
      appKeyLabel
      [x]="10"
      [y]="20"
      [fontSize]="fontSize()"
      [labels]="labels()"
      [highlightKeyCombination]="highlight()"
    ></g>
  </svg>`,
})
class HostComponent {
  readonly fontSize = signal(100);
  readonly labels = signal<KeyLabel[]>([]);
  readonly highlight = signal<HighlightKeyCombination | null>(null);
}

const combo = (layer: Layer, shiftKey: boolean, altGraphKey: boolean): HighlightKeyCombination => ({
  layer,
  shiftKey,
  altGraphKey,
  positionCodes: [],
  score: 0,
  characterKeyPositionCode: 0,
});

const str = (c: string, extra: Partial<KeyLabel> = {}): KeyLabel =>
  ({
    type: KeyLabelType.String,
    c,
    title: `t-${c}`,
    layer: Layer.Primary,
    shiftKey: false,
    altGraphKey: false,
    ...extra,
  }) as unknown as KeyLabel;

describe('KeyLabelComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;
  let component: KeyLabelComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
    component = fixture.debugElement.children[0].children[0].componentInstance;
  });

  const show = (labels: KeyLabel[], highlight: HighlightKeyCombination | null) => {
    host.labels.set(labels);
    host.highlight.set(highlight);
    fixture.detectChanges();
  };
  const el = () => fixture.nativeElement as SVGElement;
  const texts = () => Array.from(el().querySelectorAll('text'));

  describe('which labels are drawn', () => {
    it('draws nothing when no key combination is highlighted', () => {
      show([str('a')], null);
      expect(texts().length).toBe(0);
    });

    it('draws a label whose layer, Shift and AltGr all match', () => {
      show([str('a')], combo(Layer.Primary, false, false));
      expect(texts().map((t) => t.textContent!.trim())).toEqual(['a']);
    });

    it('does not draw one whose layer, Shift or AltGr differs', () => {
      show([str('a')], combo(Layer.Secondary, false, false));
      expect(texts().length).toBe(0);
      show([str('a')], combo(Layer.Primary, true, false));
      expect(texts().length).toBe(0);
      show([str('a')], combo(Layer.Primary, false, true));
      expect(texts().length).toBe(0);
    });

    it('always draws a label that belongs to no layer', () => {
      show([str('a', { layer: null })], combo(Layer.Tertiary, true, true));
      expect(texts().length).toBe(1);
    });

    it('draws a label with no Shift/AltGr on a matching layer, whatever the modifiers', () => {
      const label = str('a', { shiftKey: null, altGraphKey: null });
      show([label], combo(Layer.Primary, true, true));
      expect(texts().length).toBe(1);
      show([label], combo(Layer.Secondary, false, false));
      expect(texts().length).toBe(0);
    });

    it('needs both to be unset for that: one null is not enough', () => {
      show([str('a', { shiftKey: null })], combo(Layer.Primary, true, false));
      expect(texts().length).toBe(0);
    });

    it('draws only the labels that match, in order', () => {
      show([str('a'), str('A', { shiftKey: true }), str('b')], combo(Layer.Primary, false, false));
      expect(texts().map((t) => t.textContent!.trim())).toEqual(['a', 'b']);
    });

    it('puts the label title in a <title>', () => {
      show([str('a')], combo(Layer.Primary, false, false));
      expect(el().querySelector('title')!.textContent).toBe('t-a');
    });
  });

  describe('how a label looks', () => {
    const style = (labels: KeyLabel[]) => {
      show(labels, combo(Layer.Primary, false, false));
      return texts()[0];
    };

    it('puts the text at the given position, centered', () => {
      const t = style([str('a')]);
      expect(t.getAttribute('x')).toBe('10');
      expect(t.getAttribute('y')).toBe('20');
      expect(t.getAttribute('text-anchor')).toBe('middle');
      expect(t.getAttribute('dominant-baseline')).toBe('central');
    });

    it('draws one character at the full size', () => {
      expect(style([str('a')]).style.fontSize).toBe('100px');
    });

    it('draws two characters at 0.8 and longer text at 0.6', () => {
      expect(style([str('ab')]).style.fontSize).toBe('80px');
      expect(style([str('abc')]).style.fontSize).toBe('60px');
      expect(style([str('abcdef')]).style.fontSize).toBe('60px');
    });

    it('follows the font size it is given', () => {
      host.fontSize.set(50);
      expect(style([str('a')]).style.fontSize).toBe('50px');
    });

    it('uses the light color for text', () => {
      expect(style([str('a')]).getAttribute('fill')).toBe('#e6ebff');
    });

    it('writes an action code in parentheses, small and red', () => {
      const t = style([
        {
          type: KeyLabelType.ActionCode,
          c: 128,
          title: 'Action code 128',
          layer: Layer.Primary,
          shiftKey: false,
          altGraphKey: false,
        } as unknown as KeyLabel,
      ]);
      expect(t.textContent!.trim()).toBe('(128)');
      expect(t.style.fontSize).toBe('60px');
      expect(t.getAttribute('fill')).toBe('#f87171');
    });

    it('draws an icon with the icon font and its ligature feature, at 0.8', () => {
      const t = style([
        {
          type: KeyLabelType.Icon,
          c: 'shift',
          title: 'Shift',
          layer: Layer.Primary,
          shiftKey: false,
          altGraphKey: false,
        } as unknown as KeyLabel,
      ]);
      expect(t.textContent!.trim()).toBe('shift');
      expect(t.style.fontFamily).toContain('Material Symbols Rounded');
      expect(t.style.fontSize).toBe('80px');
    });

    // Current behavior: the feature name is written without quotes, which is
    // not valid CSS, so the browser drops it. Icons still show as glyphs
    // because ligatures are on by default.
    it('asks for the liga feature without quotes, which the browser ignores (known gap)', () => {
      const label = {
        type: KeyLabelType.Icon,
        c: 'shift',
        title: 'Shift',
        layer: Layer.Primary,
        shiftKey: false,
        altGraphKey: false,
      } as unknown as KeyLabel;
      expect(component.render(label).fontFeature).toBe('liga');
      const t = style([label]);
      expect(t.style.fontFeatureSettings).toBe('');
      expect(t.style.fontSize).toBe('80px');
    });

    it('draws a logo with the logo font, at 0.8', () => {
      const t = style([
        {
          type: KeyLabelType.Logo,
          c: '',
          title: 'Windows',
          layer: Layer.Primary,
          shiftKey: false,
          altGraphKey: false,
        } as unknown as KeyLabel,
      ]);
      expect(t.style.fontFamily).toContain('font-logos');
      expect(t.style.fontSize).toBe('80px');
    });

    it('leaves the font alone for plain text', () => {
      const t = style([str('a')]);
      expect(t.style.fontFamily).toBe('');
      expect(t.style.fontFeatureSettings).toBe('');
    });
  });

  describe('the marks under a character', () => {
    const lines = (labels: KeyLabel[]) => {
      show(labels, combo(Layer.Primary, false, false));
      return Array.from(el().querySelectorAll('line'));
    };

    it('has none for an ordinary character', () => {
      expect(lines([str('a')]).length).toBe(0);
    });

    it('has a cyan line for a dead key', () => {
      const [line] = lines([str('^', { isDeadKey: true })]);
      expect(line.getAttribute('stroke')).toBe('#22d3ee');
      expect(line.getAttribute('x1')).toBe('10');
      expect(line.getAttribute('y1')).toBe('-20');
      expect(line.getAttribute('y2')).toBe('60');
    });

    it('has a yellow line for a Windows Alt code', () => {
      const [line] = lines([str('é', { isWindowsAltCode: true })]);
      expect(line.getAttribute('stroke')).toBe('#eab308');
    });

    it('has no line for an icon, even with the flag', () => {
      expect(
        lines([
          {
            type: KeyLabelType.Icon,
            c: 'shift',
            title: '',
            layer: Layer.Primary,
            shiftKey: false,
            altGraphKey: false,
            isDeadKey: true,
          } as unknown as KeyLabel,
        ]).length,
      ).toBe(0);
    });
  });

  it('answers isLabelActive without a highlight as false', () => {
    expect(component.isLabelActive(str('a'))).toBeFalse();
  });
});
