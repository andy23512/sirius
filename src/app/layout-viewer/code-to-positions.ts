import { ACTIONS, ActionType, DeviceLayout, Layer } from 'tangent-cc-lib';

function layerFromIndex(layerIndex: number): Layer {
  switch (layerIndex) {
    case 1:
      return Layer.Secondary;
    case 2:
      return Layer.Tertiary;
    case 3:
      return Layer.Quaternary;
    default:
      return Layer.Primary;
  }
}

/**
 * The two device space keys (SpaceLeft / SpaceRight) both emit a plain Space
 * keystroke, which the OS/uiohook report as "Space". Normalize so a Space press
 * lights both physical space positions.
 */
function normalizeCode(code: string): string {
  return code === 'SpaceLeft' || code === 'SpaceRight' ? 'Space' : code;
}

/** A layout position that emits a given DOM code. */
export interface CodePosition {
  position: number;
  /**
   * True when the position only emits this code together with Shift (a WSK
   * action with `withShift`, e.g. the `?` key which sends Shift+Slash). Such a
   * position must NOT light when its code is pressed without Shift.
   */
  needsShift: boolean;
}

/**
 * Build a map from DOM code (KeyboardEvent.code) to the layout positions that
 * emit that key, across all layers. Used to light up positions when a key is
 * pressed. This is layout-independent: a device position sends a fixed HID key
 * regardless of the OS keyboard layout.
 */
export function buildCodeToPositions(
  deviceLayout: DeviceLayout | null,
): Record<string, CodePosition[]> {
  const map: Record<string, CodePosition[]> = {};
  if (!deviceLayout) {
    return map;
  }
  const layerNumber = deviceLayout.layout.length;
  const seen = new Set<string>(); // `${code}|${position}|${needsShift}`
  for (let position = 0; position < 90; position += 1) {
    for (let layer = 0; layer < layerNumber; layer += 1) {
      const action = ACTIONS.find(
        (a) => a.codeId === deviceLayout.layout[layer][position],
      );
      let code: string | null = null;
      let needsShift = false;
      if (action?.type === ActionType.WSK && action.keyCode) {
        code = normalizeCode(action.keyCode);
        needsShift = action.withShift;
      } else if (action?.type === ActionType.NonWSK && action.keyCode) {
        code = normalizeCode(action.keyCode);
      }
      if (code === null) {
        continue;
      }
      const key = `${code}|${position}|${needsShift}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      (map[code] ??= []).push({ position, needsShift });
    }
  }
  return map;
}

/**
 * Build a map from DOM code to the layers it appears on (ascending). Used to
 * switch the viewer to the layer that produces a pressed key — e.g. pressing a
 * number that only exists on the secondary layer switches to that layer.
 */
export function buildCodeToLayers(
  deviceLayout: DeviceLayout | null,
): Record<string, Layer[]> {
  const layerSets: Record<string, Set<number>> = {};
  if (!deviceLayout) {
    return {};
  }
  const layerNumber = deviceLayout.layout.length;
  for (let position = 0; position < 90; position += 1) {
    for (let layer = 0; layer < layerNumber; layer += 1) {
      const action = ACTIONS.find(
        (a) => a.codeId === deviceLayout.layout[layer][position],
      );
      if (
        (action?.type === ActionType.WSK ||
          action?.type === ActionType.NonWSK) &&
        action.keyCode
      ) {
        const code = normalizeCode(action.keyCode);
        (layerSets[code] ??= new Set()).add(layer);
      }
    }
  }
  const map: Record<string, Layer[]> = {};
  for (const [code, layers] of Object.entries(layerSets)) {
    map[code] = [...layers].sort((a, b) => a - b).map(layerFromIndex);
  }
  return map;
}

/**
 * Detect held modifier "layers" from the pressed DOM codes. Shift is either
 * ShiftLeft/ShiftRight; AltGr maps to AltRight. Used to switch the viewer to the
 * Shift / AltGr variant while those keys are held.
 */
export function liveModifiers(pressedCodes: ReadonlySet<string>): {
  shift: boolean;
  altGraph: boolean;
} {
  return {
    shift: pressedCodes.has('ShiftLeft') || pressedCodes.has('ShiftRight'),
    altGraph: pressedCodes.has('AltRight'),
  };
}

/**
 * Resolve the set of currently-pressed positions from held DOM codes. Positions
 * that only emit their key with Shift (e.g. `?` = Shift+Slash) light only while
 * Shift is held, so pressing `/` without Shift does not light `?`.
 */
export function pressedPositions(
  codeToPositions: Record<string, CodePosition[]>,
  pressedCodes: ReadonlySet<string>,
): number[] {
  const shiftHeld =
    pressedCodes.has('ShiftLeft') || pressedCodes.has('ShiftRight');
  const positions = new Set<number>();
  for (const code of pressedCodes) {
    for (const entry of codeToPositions[code] ?? []) {
      if (!entry.needsShift || shiftHeld) {
        positions.add(entry.position);
      }
    }
  }
  return [...positions];
}
