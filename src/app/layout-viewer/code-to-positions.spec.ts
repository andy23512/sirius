import { ACTIONS, ActionType, DeviceLayout, Layer } from 'tangent-cc-lib';
import {
  buildCodeToLayers,
  buildCodeToPositions,
  CodePosition,
  liveModifiers,
  pressedPositions,
} from './code-to-positions';

/** Resolve the action codeId that emits a given key, from the real action table. */
function wskCode(keyCode: string, withShift = false): number {
  const action = ACTIONS.find(
    (a) => a.type === ActionType.WSK && a.keyCode === keyCode && a.withShift === withShift,
  );
  if (!action) {
    throw new Error(`No WSK action for ${keyCode} (shift=${withShift})`);
  }
  return action.codeId;
}
function nonWskCode(keyCode: string): number {
  const action = ACTIONS.find((a) => a.type === ActionType.NonWSK && a.keyCode === keyCode);
  if (!action) {
    throw new Error(`No NonWSK action for ${keyCode}`);
  }
  return action.codeId;
}

const CODE = {
  KeyA: wskCode('KeyA'),
  KeyZ: wskCode('KeyZ'),
  Digit1: wskCode('Digit1'),
  Slash: wskCode('Slash', false), // "/"
  SlashShift: wskCode('Slash', true), // "?" = Shift+Slash
  F1: nonWskCode('F1'),
  F12: nonWskCode('F12'),
  ShiftLeft: nonWskCode('ShiftLeft'),
  SpaceLeft: nonWskCode('SpaceLeft'),
  SpaceRight: nonWskCode('SpaceRight'),
};

/** Positions used by the fixture (arbitrary but fixed). */
const POS = {
  KeyA: 5,
  Digit1: 10, // placed on the secondary layer
  F1: 20,
  F12: 21,
  ShiftLeft: 25,
  Slash: 30, // "/"
  SlashShift: 31, // "?"
  SpaceLeft: 40,
  SpaceRight: 85,
};

function emptyLayer(): number[] {
  return new Array(90).fill(0);
}

/** A controlled 3-layer device layout with known codes at known positions. */
function fixtureLayout(): DeviceLayout {
  const primary = emptyLayer();
  const secondary = emptyLayer();
  const tertiary = emptyLayer();
  primary[POS.KeyA] = CODE.KeyA;
  primary[POS.F1] = CODE.F1;
  primary[POS.F12] = CODE.F12;
  primary[POS.ShiftLeft] = CODE.ShiftLeft;
  primary[POS.Slash] = CODE.Slash;
  primary[POS.SlashShift] = CODE.SlashShift;
  primary[POS.SpaceLeft] = CODE.SpaceLeft;
  primary[POS.SpaceRight] = CODE.SpaceRight;
  secondary[POS.Digit1] = CODE.Digit1; // number only on the 2nd layer
  return {
    id: 'fixture',
    name: 'fixture',
    layout: [primary, secondary, tertiary] as unknown as DeviceLayout['layout'],
  };
}

function positionsOf(entries: CodePosition[] | undefined): number[] {
  return (entries ?? []).map((e) => e.position).sort((a, b) => a - b);
}

describe('buildCodeToPositions', () => {
  const map = buildCodeToPositions(fixtureLayout());

  it('maps letter keys to their position (no Shift required)', () => {
    expect(map['KeyA']).toEqual([{ position: POS.KeyA, needsShift: false }]);
  });

  it('maps number keys to their position', () => {
    expect(positionsOf(map['Digit1'])).toEqual([POS.Digit1]);
  });

  it('maps function keys F1 and F12 to their positions', () => {
    expect(positionsOf(map['F1'])).toEqual([POS.F1]);
    expect(positionsOf(map['F12'])).toEqual([POS.F12]);
  });

  it('maps modifier keys (ShiftLeft) to their position', () => {
    expect(positionsOf(map['ShiftLeft'])).toEqual([POS.ShiftLeft]);
  });

  it('records both the unshifted "/" and the shifted "?" for the Slash code', () => {
    const slash = map['Slash'];
    expect(slash).toContain({ position: POS.Slash, needsShift: false });
    expect(slash).toContain({ position: POS.SlashShift, needsShift: true });
  });

  it('normalizes both device space keys to Space (both light on a space press)', () => {
    expect(positionsOf(map['Space'])).toEqual([POS.SpaceLeft, POS.SpaceRight]);
    expect(map['SpaceLeft']).toBeUndefined();
  });

  it('has no entry for a key not present in the layout', () => {
    expect(map['KeyZ']).toBeUndefined();
  });

  it('returns an empty map for a null layout', () => {
    expect(buildCodeToPositions(null)).toEqual({});
  });
});

describe('buildCodeToLayers', () => {
  const layers = buildCodeToLayers(fixtureLayout());

  it('reports a letter key on the primary layer', () => {
    expect(layers['KeyA']).toEqual([Layer.Primary]);
  });

  it('reports a number key only on the secondary layer', () => {
    expect(layers['Digit1']).toEqual([Layer.Secondary]);
  });
});

describe('pressedPositions', () => {
  const map = buildCodeToPositions(fixtureLayout());

  it('lights the pressed letter key', () => {
    expect(pressedPositions(map, new Set(['KeyA']))).toEqual([POS.KeyA]);
  });

  it('lights a function key', () => {
    expect(pressedPositions(map, new Set(['F1']))).toEqual([POS.F1]);
  });

  it('lights only "/" (not "?") when Slash is pressed without Shift', () => {
    expect(pressedPositions(map, new Set(['Slash']))).toEqual([POS.Slash]);
  });

  it('lights the shifted "?" when Slash is pressed with Shift', () => {
    const lit = pressedPositions(map, new Set(['ShiftLeft', 'Slash']));
    expect(lit).toContain(POS.SlashShift);
    expect(lit).toContain(POS.ShiftLeft);
  });

  it('still lights a letter when Shift is held (letters do not need Shift)', () => {
    const lit = pressedPositions(map, new Set(['ShiftLeft', 'KeyA']));
    expect(lit.sort((a, b) => a - b)).toEqual([POS.KeyA, POS.ShiftLeft]);
  });

  it('lights both the Shift key and the number for Shift + number', () => {
    const lit = pressedPositions(map, new Set(['ShiftLeft', 'Digit1']));
    expect(lit.sort((a, b) => a - b)).toEqual([POS.Digit1, POS.ShiftLeft]);
  });

  it('ignores codes with no position', () => {
    expect(pressedPositions(map, new Set(['KeyZ']))).toEqual([]);
  });
});

describe('liveModifiers', () => {
  it('detects Shift from ShiftLeft or ShiftRight', () => {
    expect(liveModifiers(new Set(['ShiftLeft'])).shift).toBeTrue();
    expect(liveModifiers(new Set(['ShiftRight'])).shift).toBeTrue();
  });

  it('detects AltGr from AltRight', () => {
    expect(liveModifiers(new Set(['AltRight'])).altGraph).toBeTrue();
  });

  it('reports no modifiers for ordinary keys', () => {
    const mods = liveModifiers(new Set(['KeyA', 'Digit1']));
    expect(mods.shift).toBeFalse();
    expect(mods.altGraph).toBeFalse();
  });
});

function layoutOf(layers: Record<number, number>[]): DeviceLayout {
  return {
    id: 'x',
    name: 'x',
    layout: layers.map((entries) => {
      const layer = emptyLayer();
      for (const [position, code] of Object.entries(entries)) {
        layer[Number(position)] = code;
      }
      return layer;
    }) as unknown as DeviceLayout['layout'],
  };
}

describe('buildCodeToPositions, more cases', () => {
  it('lists each position once, even when it has the same key on every layer', () => {
    const map = buildCodeToPositions(
      layoutOf([{ 7: CODE.KeyA }, { 7: CODE.KeyA }, { 7: CODE.KeyA }]),
    );
    expect(map['KeyA']).toEqual([{ position: 7, needsShift: false }]);
  });

  it('lists every position that has the key, lowest position first', () => {
    const map = buildCodeToPositions(
      layoutOf([{ 50: CODE.KeyA, 3: CODE.KeyA }, { 20: CODE.KeyA }]),
    );
    expect(positionsOf(map['KeyA'])).toEqual([3, 20, 50]);
    expect(map['KeyA'].map((e) => e.position)).toEqual([3, 20, 50]);
  });

  it('keeps a position twice when it has the key with and without Shift', () => {
    const map = buildCodeToPositions(layoutOf([{ 9: CODE.Slash }, { 9: CODE.SlashShift }]));
    expect(map['Slash']).toEqual([
      { position: 9, needsShift: false },
      { position: 9, needsShift: true },
    ]);
  });

  it('looks at a fourth layer too', () => {
    const map = buildCodeToPositions(layoutOf([{}, {}, {}, { 12: CODE.KeyZ }]));
    expect(map['KeyZ']).toEqual([{ position: 12, needsShift: false }]);
  });

  it('does not need Shift for the non-WSK keys', () => {
    const map = buildCodeToPositions(layoutOf([{ 1: CODE.F1 }]));
    expect(map['F1']).toEqual([{ position: 1, needsShift: false }]);
  });

  it('ignores codes that are not a key: empty, unknown, or not a keystroke', () => {
    const NO_BREAK_SPACE = ACTIONS.find((a) => a.type === ActionType.NonKey)!.codeId;
    const ALT_CODE = ACTIONS.find((a) => a.type === ActionType.WindowsAltCode)!.codeId;
    expect(
      buildCodeToPositions(layoutOf([{ 0: 0, 1: 128, 2: NO_BREAK_SPACE, 3: ALT_CODE }])),
    ).toEqual({});
  });

  it('covers every position up to 89, and nothing past that', () => {
    const map = buildCodeToPositions(layoutOf([{ 0: CODE.KeyA, 89: CODE.KeyZ }]));
    expect(positionsOf(map['KeyA'])).toEqual([0]);
    expect(positionsOf(map['KeyZ'])).toEqual([89]);
  });

  it('gives a layout with no layers an empty map', () => {
    expect(buildCodeToPositions(layoutOf([]))).toEqual({});
  });
});

describe('buildCodeToLayers, more cases', () => {
  it('gives an empty map for a null layout', () => {
    expect(buildCodeToLayers(null)).toEqual({});
  });

  it('names the layers by their order: second, third and fourth', () => {
    const map = buildCodeToLayers(
      layoutOf([{}, { 1: CODE.KeyA }, { 1: CODE.KeyZ }, { 1: CODE.Digit1 }]),
    );
    expect(map['KeyA']).toEqual([Layer.Secondary]);
    expect(map['KeyZ']).toEqual([Layer.Tertiary]);
    expect(map['Digit1']).toEqual([Layer.Quaternary]);
  });

  it('lists the layers of a key in order, whatever the order of positions', () => {
    const map = buildCodeToLayers(
      layoutOf([{ 80: CODE.KeyA }, {}, { 2: CODE.KeyA }, { 40: CODE.KeyA }]),
    );
    expect(map['KeyA']).toEqual([Layer.Primary, Layer.Tertiary, Layer.Quaternary]);
  });

  it('lists a layer once, even with the key at several positions', () => {
    const map = buildCodeToLayers(layoutOf([{ 1: CODE.KeyA, 2: CODE.KeyA, 3: CODE.KeyA }]));
    expect(map['KeyA']).toEqual([Layer.Primary]);
  });

  it('counts the Shift version of a key as that key', () => {
    const map = buildCodeToLayers(layoutOf([{ 1: CODE.Slash }, { 1: CODE.SlashShift }]));
    expect(map['Slash']).toEqual([Layer.Primary, Layer.Secondary]);
  });

  it('turns both space keys into one Space entry', () => {
    const map = buildCodeToLayers(layoutOf([{ 1: CODE.SpaceLeft }, { 2: CODE.SpaceRight }]));
    expect(map['Space']).toEqual([Layer.Primary, Layer.Secondary]);
    expect(map['SpaceLeft']).toBeUndefined();
    expect(map['SpaceRight']).toBeUndefined();
  });

  it('ignores codes that are not a key', () => {
    expect(buildCodeToLayers(layoutOf([{ 0: 0, 1: 128 }]))).toEqual({});
  });
});

describe('pressedPositions, more cases', () => {
  const map = buildCodeToPositions(fixtureLayout());

  it('gives nothing when nothing is held', () => {
    expect(pressedPositions(map, new Set())).toEqual([]);
  });

  it('lights the shifted key with the right Shift as well', () => {
    const lit = pressedPositions(map, new Set(['ShiftRight', 'Slash']));
    expect(lit).toContain(POS.SlashShift);
    expect(lit).toContain(POS.Slash);
  });

  it('lights both space keys for one Space', () => {
    expect(pressedPositions(map, new Set(['Space'])).sort((a, b) => a - b)).toEqual([
      POS.SpaceLeft,
      POS.SpaceRight,
    ]);
  });

  it('does not light a position twice when two held keys lead to it', () => {
    const shared: Record<string, CodePosition[]> = {
      A: [{ position: 4, needsShift: false }],
      B: [{ position: 4, needsShift: false }],
    };
    expect(pressedPositions(shared, new Set(['A', 'B']))).toEqual([4]);
  });

  it('lights nothing for a key with only Shift positions, if Shift is not held', () => {
    const onlyShift: Record<string, CodePosition[]> = {
      Slash: [{ position: 4, needsShift: true }],
    };
    expect(pressedPositions(onlyShift, new Set(['Slash']))).toEqual([]);
    expect(pressedPositions(onlyShift, new Set(['Slash', 'ShiftLeft']))).toEqual([4]);
  });

  it('works with an empty map', () => {
    expect(pressedPositions({}, new Set(['KeyA']))).toEqual([]);
  });
});

describe('liveModifiers, more cases', () => {
  it('reports no modifiers for nothing held', () => {
    expect(liveModifiers(new Set())).toEqual({ shift: false, altGraph: false });
  });

  it('reports both together', () => {
    expect(liveModifiers(new Set(['ShiftLeft', 'AltRight']))).toEqual({
      shift: true,
      altGraph: true,
    });
  });

  it('does not take the left Alt or Ctrl or Meta for AltGr or Shift', () => {
    expect(liveModifiers(new Set(['AltLeft', 'ControlLeft', 'MetaLeft']))).toEqual({
      shift: false,
      altGraph: false,
    });
  });

  it('does not take AltRight for Shift, nor Shift for AltGr', () => {
    expect(liveModifiers(new Set(['AltRight'])).shift).toBeFalse();
    expect(liveModifiers(new Set(['ShiftRight'])).altGraph).toBeFalse();
  });
});
