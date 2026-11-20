import {
  ACTIONS,
  ActionType,
  CC1_CC2_LEFT_HAND_ONLY_DEVICE_LAYOUT,
  CCLITE_DEFAULT_DEVICE_LAYOUT,
  DEFAULT_DEVICE_LAYOUT,
  DeviceLayout,
  KeyboardLayout,
  KeyLabel,
  KeyLabelType,
  Layer,
  M4G_DEFAULT_DEVICE_LAYOUT,
  OperatingSystemName,
} from 'tangent-cc-lib';
import { buildKeyLabelMap, getHighlightPositionCodes } from './key-label-map';

function wsk(keyCode: string, withShift: boolean): number {
  const a = ACTIONS.find(
    (x) => x.type === ActionType.WSK && x.keyCode === keyCode && x.withShift === withShift,
  );
  if (!a) throw new Error(`no WSK ${keyCode} ${withShift}`);
  return a.codeId;
}
function nonWsk(keyCode: string): number {
  const a = ACTIONS.find((x) => x.type === ActionType.NonWSK && x.keyCode === keyCode);
  if (!a) throw new Error(`no NonWSK ${keyCode}`);
  return a.codeId;
}
function nonKey(actionName: string): number {
  const a = ACTIONS.find((x) => x.type === ActionType.NonKey && x.actionName === actionName);
  if (!a) throw new Error(`no NonKey ${actionName}`);
  return a.codeId;
}
function windowsAltCode(character: string): number {
  const a = ACTIONS.find((x) => x.type === ActionType.WindowsAltCode && x.character === character);
  if (!a) throw new Error(`no WindowsAltCode ${character}`);
  return a.codeId;
}

const text = (value: string) => ({ type: 'text' as const, value });
const dead = (value: string) => ({ type: 'dead-key' as const, value });

const KEYBOARD: KeyboardLayout = {
  id: 'test',
  name: 'test',
  reference: '',
  layout: {
    KeyA: {
      unmodified: text('a'),
      withShift: text('A'),
      withAltGraph: text('å'),
      withShiftAltGraph: text('Å'),
    },
    KeyB: { unmodified: text('b'), withShift: dead('^') },
    KeyD: { unmodified: dead('`') },
    KeyE: { unmodified: text('e') },
    KeyS: { withShift: text('S'), withShiftAltGraph: dead('ß') },
    KeyT: { withShift: dead('T'), withShiftAltGraph: text('þ') },
    Digit1: { unmodified: text('1'), withShift: text('!') },
  },
};

/** A device layout with the given codes at position 0 of each layer (others empty). */
function layoutWith(...codesPerLayer: number[]): DeviceLayout {
  return {
    id: 'fixture',
    name: 'fixture',
    layout: codesPerLayer.map((code) => {
      const layer = new Array(90).fill(0);
      layer[0] = code;
      return layer;
    }) as unknown as DeviceLayout['layout'],
  };
}

function labelsAt0(
  code: number,
  keyboard: KeyboardLayout = KEYBOARD,
  os: OperatingSystemName | undefined = undefined,
): KeyLabel[] {
  return buildKeyLabelMap(layoutWith(code, 0, 0), keyboard, os)![0];
}

/** `isDeadKey` is only on some label kinds, so it is read loosely. */
const isDead = (l: KeyLabel) => (l as { isDeadKey?: boolean }).isDeadKey;

/** What matters about a label, for comparing a list of them. */
const brief = (labels: KeyLabel[]) =>
  labels.map((l) => [l.c, l.layer, l.shiftKey, l.altGraphKey] as const);

describe('buildKeyLabelMap', () => {
  describe('what it needs', () => {
    it('gives null without a device layout', () => {
      expect(buildKeyLabelMap(null, KEYBOARD, undefined)).toBeNull();
    });

    it('gives null without an OS keyboard layout', () => {
      expect(buildKeyLabelMap(layoutWith(1, 2, 3), null, undefined)).toBeNull();
    });

    it('gives an entry for each of the 90 positions, empty where there is nothing', () => {
      const map = buildKeyLabelMap(layoutWith(0, 0, 0), KEYBOARD, undefined)!;
      expect(Object.keys(map).map(Number)).toEqual(Array.from({ length: 90 }, (_, i) => i));
      expect(Object.values(map).every((l) => l.length === 0)).toBeTrue();
    });

    it('has nothing for positions past the end of a shorter layout, such as the 67 keys of the Lite', () => {
      const map = buildKeyLabelMap(CCLITE_DEFAULT_DEVICE_LAYOUT, KEYBOARD, undefined)!;
      expect(Object.keys(map).length).toBe(90);
      for (let p = 67; p < 90; p += 1) {
        expect(map[p]).toEqual([]);
      }
      expect(
        Object.values(map)
          .slice(0, 67)
          .some((l) => l.length > 0),
      ).toBeTrue();
    });
  });

  describe('layers', () => {
    it('lists the labels of each layer in order, marked with their layer', () => {
      const a = wsk('Digit1', false);
      const labels = buildKeyLabelMap(layoutWith(a, a, a, a), KEYBOARD, undefined)![0];
      expect(labels.map((l) => l.layer)).toEqual([
        Layer.Primary,
        Layer.Primary,
        Layer.Secondary,
        Layer.Secondary,
        Layer.Tertiary,
        Layer.Tertiary,
        Layer.Quaternary,
        Layer.Quaternary,
      ]);
    });

    it('only looks at the layers the layout has', () => {
      const a = wsk('Digit1', false);
      const labels = buildKeyLabelMap(layoutWith(a, 0), KEYBOARD, undefined)![0];
      expect(labels.length).toBe(2);
      expect(new Set(labels.map((l) => l.layer))).toEqual(new Set([Layer.Primary]));
    });

    it('can have a different action on each layer', () => {
      const map = buildKeyLabelMap(
        layoutWith(wsk('KeyE', false), wsk('Digit1', false), 0),
        KEYBOARD,
        undefined,
      )!;
      expect(brief(map[0])).toEqual([
        ['e', Layer.Primary, false, false],
        ['1', Layer.Secondary, false, false],
        ['!', Layer.Secondary, true, false],
      ]);
    });
  });

  describe('a key without Shift (WSK)', () => {
    it('gives a label for each way the OS layout can type it, in the order: plain, Shift, AltGr, Shift+AltGr', () => {
      expect(brief(labelsAt0(wsk('KeyA', false)))).toEqual([
        ['a', Layer.Primary, false, false],
        ['A', Layer.Primary, true, false],
        ['å', Layer.Primary, false, true],
        ['Å', Layer.Primary, true, true],
      ]);
    });

    it('skips the ways the OS layout has no output for', () => {
      expect(brief(labelsAt0(wsk('KeyE', false)))).toEqual([['e', Layer.Primary, false, false]]);
    });

    it('has no labels for a key the OS layout does not have', () => {
      expect(labelsAt0(wsk('KeyZ', false))).toEqual([]);
    });

    it('titles a character label with the character', () => {
      const [first] = labelsAt0(wsk('KeyA', false));
      expect(first.type).toBe(KeyLabelType.String);
      expect(first.title).toBe('Character: a');
      expect(isDead(first)).toBeFalse();
    });

    it('marks a dead key, in its title as well', () => {
      const [plain, shifted] = labelsAt0(wsk('KeyB', false));
      expect(isDead(plain)).toBeFalse();
      expect(plain.title).toBe('Character: b');
      expect(isDead(shifted)).toBeTrue();
      expect(shifted.title).toBe('Dead key: ^');
      expect(isDead(labelsAt0(wsk('KeyD', false))[0])).toBeTrue();
    });

    it('marks a dead key on the Shift+AltGr output too', () => {
      const labels = labelsAt0(wsk('KeyT', false));
      expect(labels.map((l) => [l.c, isDead(l)])).toEqual([
        ['T', true],
        ['þ', false],
      ]);
    });
  });

  describe('a key with Shift (WSK with Shift)', () => {
    it('shows the Shift output under both Shift states', () => {
      expect(brief(labelsAt0(wsk('KeyA', true)))).toEqual([
        ['A', Layer.Primary, false, false],
        ['A', Layer.Primary, true, false],
        ['Å', Layer.Primary, false, true],
        ['Å', Layer.Primary, true, true],
      ]);
    });

    it('does not use the plain output, nor the AltGr-only one', () => {
      expect(labelsAt0(wsk('KeyE', true))).toEqual([]);
    });

    it('marks a dead key on the Shift output', () => {
      const labels = labelsAt0(wsk('KeyB', true));
      expect(labels.map((l) => [l.c, l.shiftKey, isDead(l)])).toEqual([
        ['^', false, true],
        ['^', true, true],
      ]);
      expect(labels[0].title).toBe('Dead key: ^');
    });

    it('marks a dead key on both Shift+AltGr labels', () => {
      const labels = labelsAt0(wsk('KeyS', true));
      expect(labels.map((l) => [l.c, l.shiftKey, l.altGraphKey, isDead(l), l.title])).toEqual([
        ['S', false, false, false, 'Character: S'],
        ['S', true, false, false, 'Character: S'],
        ['ß', false, true, true, 'Dead key: ß'],
        ['ß', true, true, true, 'Dead key: ß'],
      ]);
    });
  });

  describe('keys that are not characters', () => {
    it('gives a function key its label, for any state', () => {
      const [label] = labelsAt0(nonWsk('F1'));
      expect(label.type).toBe(KeyLabelType.String);
      expect(label.c).toBe('F1');
      expect(label.layer).toBe(Layer.Primary);
      expect(label.shiftKey).toBeFalse();
      expect(label.altGraphKey).toBeFalse();
      expect(labelsAt0(nonWsk('F1')).length).toBe(1);
    });

    it('gives a plain key label without an OS, or with one it does not know', () => {
      expect(labelsAt0(nonWsk('MetaLeft'))[0].c).toBe('apps');
      expect(labelsAt0(nonWsk('MetaLeft'), KEYBOARD, 'NoSuchOs' as OperatingSystemName)[0].c).toBe(
        'apps',
      );
      expect(labelsAt0(nonWsk('AltLeft'))[0].c).toBe('ALT');
    });

    it('draws the Meta key the way the OS does', () => {
      expect(labelsAt0(nonWsk('MetaLeft'), KEYBOARD, 'macOS' as OperatingSystemName)[0].c).toBe(
        'keyboard_command_key',
      );
      expect(labelsAt0(nonWsk('MetaLeft'), KEYBOARD, 'Windows' as OperatingSystemName)[0].c).toBe(
        'window',
      );
      expect(
        labelsAt0(nonWsk('MetaRight'), KEYBOARD, 'macOS' as OperatingSystemName)[0].title,
      ).toBe('key-label.apple-meta-right');
    });

    it('draws the Alt key as Option on Apple systems', () => {
      expect(labelsAt0(nonWsk('AltLeft'), KEYBOARD, 'macOS' as OperatingSystemName)[0].c).toBe(
        'keyboard_option_key',
      );
      expect(labelsAt0(nonWsk('AltRight'), KEYBOARD, 'iOS' as OperatingSystemName)[0].c).toBe(
        'keyboard_option_key',
      );
    });

    it('keeps the plain Alt label on other systems', () => {
      expect(labelsAt0(nonWsk('AltLeft'), KEYBOARD, 'Windows' as OperatingSystemName)[0].c).toBe(
        'ALT',
      );
    });

    it('is not changed by the OS for keys that have no OS version', () => {
      expect(labelsAt0(nonWsk('F1'), KEYBOARD, 'macOS' as OperatingSystemName)[0].c).toBe('F1');
    });

    it('gives an action that is not a key its label', () => {
      const [label] = labelsAt0(nonKey('NoBreakSpace'));
      expect(label.c).toBe('NBSP');
      expect(label.layer).toBe(Layer.Primary);
      expect(label.shiftKey).toBeFalse();
      expect(label.altGraphKey).toBeFalse();
    });

    it('gives a Windows Alt code the character, marked as such', () => {
      const [label] = labelsAt0(windowsAltCode('é'));
      expect(label).toEqual({
        type: KeyLabelType.String,
        c: 'é',
        title: 'Windows Alt code: é',
        layer: Layer.Primary,
        shiftKey: false,
        altGraphKey: false,
        isWindowsAltCode: true,
      });
    });
  });

  describe('codes with no action', () => {
    it('shows a code from 32 up that no action has, as a number in the labels', () => {
      expect(ACTIONS.some((a) => a.codeId === 128)).toBeFalse();
      expect(labelsAt0(128)[0]).toEqual({
        type: KeyLabelType.ActionCode,
        c: 128,
        title: 'Action code 128',
        layer: Layer.Primary,
        shiftKey: false,
        altGraphKey: false,
      });
    });

    it('shows nothing for 0 and the other codes under 32', () => {
      for (const code of [0, 1, 17, 31]) {
        expect(labelsAt0(code)).withContext(String(code)).toEqual([]);
      }
    });

    it('shows 32, which is a real action, as that action and not as a number', () => {
      expect(ACTIONS.some((a) => a.codeId === 32)).toBeTrue();
      expect(labelsAt0(32)[0].type).not.toBe(KeyLabelType.ActionCode);
    });
  });

  describe('with a real layout', () => {
    const map = buildKeyLabelMap(
      DEFAULT_DEVICE_LAYOUT,
      {
        ...KEYBOARD,
        layout: { ...KEYBOARD.layout, KeyA: { unmodified: text('a'), withShift: text('A') } },
      },
      undefined,
    )!;

    it('has the letter A on position 61 of the primary layer, and not on others', () => {
      // from the default layout: its primary layer has the code of "a" at 61
      const onPrimary = map[61].filter((l) => l.layer === Layer.Primary);
      expect(onPrimary.map((l) => l.c)).toEqual(['a', 'A']);
    });

    it('has the Shift key on position 31 on every layer', () => {
      const layers = map[31].map((l) => l.layer);
      expect(layers).toEqual([Layer.Primary, Layer.Secondary, Layer.Tertiary]);
      expect(map[31].every((l) => l.type === KeyLabelType.Icon && l.c === 'shift')).toBeTrue();
    });
  });
});

describe('getHighlightPositionCodes', () => {
  const dflt = DEFAULT_DEVICE_LAYOUT;

  it('gives nothing without a device layout', () => {
    expect(getHighlightPositionCodes(null, Layer.Secondary, true, true)).toEqual([]);
  });

  it('gives nothing on the primary layer with no modifier', () => {
    expect(getHighlightPositionCodes(dflt, Layer.Primary, false, false)).toEqual([]);
  });

  it('gives the keys that switch to each layer', () => {
    expect(getHighlightPositionCodes(dflt, Layer.Secondary, false, false)).toEqual([33, 78]);
    expect(getHighlightPositionCodes(dflt, Layer.Tertiary, false, false)).toEqual([30, 75]);
    expect(getHighlightPositionCodes(dflt, Layer.Quaternary, false, false)).toEqual([]);
  });

  it('uses the layer-switch keys of the layout it is given', () => {
    expect(
      getHighlightPositionCodes(M4G_DEFAULT_DEVICE_LAYOUT, Layer.Tertiary, false, false),
    ).toEqual([89]);
    expect(
      getHighlightPositionCodes(CCLITE_DEFAULT_DEVICE_LAYOUT, Layer.Secondary, false, false),
    ).toEqual([4, 7]);
  });

  it('adds the Shift keys when Shift is on', () => {
    expect(getHighlightPositionCodes(dflt, Layer.Primary, true, false)).toEqual([31, 76]);
  });

  it('adds the AltGr key when AltGr is on', () => {
    expect(getHighlightPositionCodes(dflt, Layer.Primary, false, true)).toEqual([77]);
  });

  it('puts the layer keys first, then Shift, then AltGr', () => {
    expect(getHighlightPositionCodes(dflt, Layer.Secondary, true, true)).toEqual([
      33, 78, 31, 76, 77,
    ]);
  });

  it('gives only what the layout has: the left-hand layout has no AltGr key', () => {
    expect(
      getHighlightPositionCodes(CC1_CC2_LEFT_HAND_ONLY_DEVICE_LAYOUT, Layer.Primary, true, true),
    ).toEqual([31]);
    expect(
      getHighlightPositionCodes(
        CC1_CC2_LEFT_HAND_ONLY_DEVICE_LAYOUT,
        Layer.Secondary,
        false,
        false,
      ),
    ).toEqual([33]);
  });
});
