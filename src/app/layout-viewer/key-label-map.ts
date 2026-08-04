import {
  ACTIONS,
  ActionType,
  DeviceLayout,
  getLayerShiftPositionCodeMap,
  getModifierKeyPositionCodeMap,
  KeyboardLayout,
  KeyLabel,
  KeyLabelType,
  Layer,
  NON_KEY_ACTION_NAME_2_RAW_KEY_LABEL_MAP,
  NON_WSK_CODE_2_RAW_KEY_LABEL_MAP,
  OperatingSystemName,
  OS_2_ALT_KEY_LABEL_MAP,
  OS_2_META_KEY_LABEL_MAP,
} from 'tangent-cc-lib';

/** Map a 0-based layer index to the Layer enum value. */
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
 * Build the position-code -> KeyLabel[] map from a device layout and the
 * selected OS keyboard layout. Ported from Alnitak's LayoutViewerPage; the i18n
 * lookups are replaced with plain English titles (used as SVG tooltips).
 */
export function buildKeyLabelMap(
  deviceLayout: DeviceLayout | null,
  keyboardLayout: KeyboardLayout | null,
  operatingSystem: OperatingSystemName | undefined,
): Record<number, KeyLabel[]> | null {
  if (!deviceLayout || !keyboardLayout) {
    return null;
  }
  const layerNumber = deviceLayout.layout.length;
  const keyLabelMap: Record<number, KeyLabel[]> = {};

  for (let positionIndex = 0; positionIndex < 90; positionIndex += 1) {
    const keyLabels: KeyLabel[] = [];
    for (let layerIndex = 0; layerIndex < layerNumber; layerIndex += 1) {
      const layer = layerFromIndex(layerIndex);
      const actionCodeId = deviceLayout.layout[layerIndex][positionIndex];
      const action = ACTIONS.find((a) => a.codeId === actionCodeId);

      if (action?.type === ActionType.WSK && action.keyCode) {
        const keyboardLayoutKey = keyboardLayout.layout[action.keyCode];
        if (action.withShift) {
          if (keyboardLayoutKey?.withShift) {
            const output = keyboardLayoutKey.withShift;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push(
              {
                type: KeyLabelType.String,
                c: output.value,
                title: characterTitle(output.value, isDeadKey),
                layer,
                shiftKey: false,
                altGraphKey: false,
                isDeadKey,
              },
              {
                type: KeyLabelType.String,
                c: output.value,
                title: characterTitle(output.value, isDeadKey),
                layer,
                shiftKey: true,
                altGraphKey: false,
                isDeadKey,
              },
            );
          }
          if (keyboardLayoutKey?.withShiftAltGraph) {
            const output = keyboardLayoutKey.withShiftAltGraph;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push(
              {
                type: KeyLabelType.String,
                c: output.value,
                title: characterTitle(output.value, isDeadKey),
                layer,
                shiftKey: false,
                altGraphKey: true,
              },
              {
                type: KeyLabelType.String,
                c: output.value,
                title: characterTitle(output.value, isDeadKey),
                layer,
                shiftKey: true,
                altGraphKey: true,
                isDeadKey,
              },
            );
          }
        } else {
          if (keyboardLayoutKey?.unmodified) {
            const output = keyboardLayoutKey.unmodified;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push({
              type: KeyLabelType.String,
              c: output.value,
              title: characterTitle(output.value, isDeadKey),
              layer,
              shiftKey: false,
              altGraphKey: false,
              isDeadKey,
            });
          }
          if (keyboardLayoutKey?.withShift) {
            const output = keyboardLayoutKey.withShift;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push({
              type: KeyLabelType.String,
              c: output.value,
              title: characterTitle(output.value, isDeadKey),
              layer,
              shiftKey: true,
              altGraphKey: false,
              isDeadKey,
            });
          }
          if (keyboardLayoutKey?.withAltGraph) {
            const output = keyboardLayoutKey.withAltGraph;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push({
              type: KeyLabelType.String,
              c: output.value,
              title: characterTitle(output.value, isDeadKey),
              layer,
              shiftKey: false,
              altGraphKey: true,
              isDeadKey,
            });
          }
          if (keyboardLayoutKey?.withShiftAltGraph) {
            const output = keyboardLayoutKey.withShiftAltGraph;
            const isDeadKey = output.type === 'dead-key';
            keyLabels.push({
              type: KeyLabelType.String,
              c: output.value,
              title: characterTitle(output.value, isDeadKey),
              layer,
              shiftKey: true,
              altGraphKey: true,
              isDeadKey,
            });
          }
        }
      } else if (action?.type === ActionType.NonWSK && action.keyCode) {
        let rawKeyLabelMap = NON_WSK_CODE_2_RAW_KEY_LABEL_MAP;
        if (operatingSystem) {
          if (OS_2_META_KEY_LABEL_MAP[operatingSystem]) {
            rawKeyLabelMap = {
              ...rawKeyLabelMap,
              ...OS_2_META_KEY_LABEL_MAP[operatingSystem],
            };
          }
          if (OS_2_ALT_KEY_LABEL_MAP[operatingSystem]) {
            rawKeyLabelMap = {
              ...rawKeyLabelMap,
              ...OS_2_ALT_KEY_LABEL_MAP[operatingSystem],
            };
          }
        }
        const rawKeyLabel = rawKeyLabelMap[action.keyCode];
        if (rawKeyLabel) {
          keyLabels.push({
            ...rawKeyLabel,
            layer,
            shiftKey: false,
            altGraphKey: false,
          });
        }
      } else if (action?.type === ActionType.NonKey && action.actionName) {
        const rawKeyLabel = NON_KEY_ACTION_NAME_2_RAW_KEY_LABEL_MAP[action.actionName];
        if (rawKeyLabel) {
          keyLabels.push({
            ...rawKeyLabel,
            layer,
            shiftKey: false,
            altGraphKey: false,
          });
        }
      } else if (action?.type === ActionType.WindowsAltCode && action.character) {
        keyLabels.push({
          type: KeyLabelType.String,
          c: action.character,
          title: `Windows Alt code: ${action.character}`,
          layer,
          shiftKey: false,
          altGraphKey: false,
          isWindowsAltCode: true,
        });
      } else if (actionCodeId >= 32) {
        keyLabels.push({
          type: KeyLabelType.ActionCode,
          c: actionCodeId,
          title: `Action code ${actionCodeId}`,
          layer,
          shiftKey: false,
          altGraphKey: false,
        });
      }
    }
    keyLabelMap[positionIndex] = keyLabels;
  }
  return keyLabelMap;
}

function characterTitle(value: string, isDeadKey: boolean): string {
  return isDeadKey ? `Dead key: ${value}` : `Character: ${value}`;
}

/**
 * Position codes that must be held to reach the given layer/modifier state,
 * used to draw the "hold these" highlight. Ported from Alnitak's page.
 */
export function getHighlightPositionCodes(
  deviceLayout: DeviceLayout | null,
  layer: Layer,
  shiftKey: boolean,
  altGraphKey: boolean,
): number[] {
  if (!deviceLayout) {
    return [];
  }
  const highlightPositionCodes: number[] = [];
  const modifierKeyPositionCodeMap = getModifierKeyPositionCodeMap(deviceLayout);
  const layerShiftKeyPositionCodeMap = getLayerShiftPositionCodeMap(deviceLayout);
  switch (layer) {
    case Layer.Secondary:
      highlightPositionCodes.push(...layerShiftKeyPositionCodeMap.numShift);
      break;
    case Layer.Tertiary:
      highlightPositionCodes.push(...layerShiftKeyPositionCodeMap.fnShift);
      break;
    case Layer.Quaternary:
      highlightPositionCodes.push(...layerShiftKeyPositionCodeMap.flagShift);
      break;
  }
  if (shiftKey) {
    if (!modifierKeyPositionCodeMap.shift[layer]) {
      return [];
    }
    highlightPositionCodes.push(...modifierKeyPositionCodeMap.shift[layer]);
  }
  if (altGraphKey) {
    if (!modifierKeyPositionCodeMap.altGraph[layer]) {
      return [];
    }
    highlightPositionCodes.push(...modifierKeyPositionCodeMap.altGraph[layer]);
  }
  return highlightPositionCodes;
}
