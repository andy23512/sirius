import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { HighlightKeyCombination, KeyLabel, KeyLabelType } from 'tangent-cc-lib';

/** Resolved on-screen representation of a key label. */
interface RenderedLabel {
  text: string;
  /** SVG font-family to apply, or null for the default UI font. */
  fontFamily: string | null;
  /** font-feature-settings (e.g. 'liga' for icon ligatures), or null. */
  fontFeature: string | null;
  fontSize: number;
}

const ICON_FONT = 'Material Symbols Rounded';
const LOGO_FONT = 'font-logos';

@Component({
  selector: '[appKeyLabel]',
  standalone: true,
  templateUrl: './key-label.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeyLabelComponent {
  readonly x = input.required<number>();
  readonly y = input.required<number>();
  readonly fontSize = input<number>(80);
  readonly highlightKeyCombination = input<HighlightKeyCombination | null>(null);
  readonly labels = input.required<KeyLabel[]>();
  readonly KeyLabelType = KeyLabelType;

  isLabelActive(label: KeyLabel): boolean {
    const highlightKeyCombination = this.highlightKeyCombination();
    return Boolean(
      highlightKeyCombination &&
        ((label.layer === highlightKeyCombination.layer &&
          label.shiftKey === highlightKeyCombination.shiftKey &&
          label.altGraphKey === highlightKeyCombination.altGraphKey) ||
          label.layer === null ||
          (label.layer === highlightKeyCombination.layer &&
            label.shiftKey === null &&
            label.altGraphKey === null)),
    );
  }

  /** Resolve a label to its display text + font. */
  render(label: KeyLabel): RenderedLabel {
    const base = this.fontSize();
    switch (label.type) {
      case KeyLabelType.String:
        return {
          text: label.c,
          fontFamily: null,
          fontFeature: null,
          fontSize: stringFontSize(label.c, base),
        };
      case KeyLabelType.ActionCode:
        return {
          text: `(${label.c})`,
          fontFamily: null,
          fontFeature: null,
          fontSize: base * 0.6,
        };
      case KeyLabelType.Logo:
        // FontLogo values are already codepoint glyphs; just apply the font.
        return {
          text: label.c,
          fontFamily: LOGO_FONT,
          fontFeature: null,
          fontSize: base * 0.8,
        };
      case KeyLabelType.Icon:
        // Material Symbols renders the ligature name (e.g. "backspace") as a glyph.
        return {
          text: label.c,
          fontFamily: ICON_FONT,
          fontFeature: 'liga',
          fontSize: base * 0.8,
        };
    }
    return { text: '', fontFamily: null, fontFeature: null, fontSize: base };
  }

  /** Color for the label text: red for raw action codes, light otherwise. */
  color(label: KeyLabel): string {
    return label.type === KeyLabelType.ActionCode ? '#f87171' : '#e6ebff';
  }
}

function stringFontSize(c: string, base: number): number {
  if (c.length > 2) {
    return base * 0.6;
  }
  if (c.length > 1) {
    return base * 0.8;
  }
  return base;
}
