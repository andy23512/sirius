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
