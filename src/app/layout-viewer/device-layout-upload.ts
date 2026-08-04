import { DeviceLayout } from 'tangent-cc-lib';

/** Devices whose layout entry we accept from a full CharaChorder backup. */
const ACCEPTED_DEVICES = ['One', 'ONE', 'TWO', 'M4G'];

/**
 * Parse an uploaded CharaChorder layout file into a DeviceLayout. Accepts either
 * a full backup ({ history: [[ { type: 'layout', device, layout } ... ]] }) or a
 * bare layout object ({ layout: [...] }). Ported from Alnitak's
 * loadDeviceLayoutFile() + DeviceLayoutImportDialog.
 */
export function parseDeviceLayoutFile(fileName: string, text: string): DeviceLayout {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }

  const record = data as { history?: unknown; layout?: unknown };
  let layoutItem: { layout?: unknown } | null = null;

  if (Array.isArray(record.history)) {
    const firstHistory = record.history[0];
    if (Array.isArray(firstHistory)) {
      layoutItem =
        firstHistory.find(
          (item: { type?: string; device?: string }) =>
            item?.type === 'layout' && ACCEPTED_DEVICES.includes(item?.device ?? ''),
        ) ?? null;
    }
  } else {
    layoutItem = record as { layout?: unknown };
  }

  if (!layoutItem || !Array.isArray(layoutItem.layout)) {
    throw new Error('No CharaChorder layout found in this file.');
  }

  const layout = layoutItem.layout;
  validateLayoutShape(layout);

  const name = fileName.replace(/\.[^.]+$/, '') || 'Uploaded layout';
  return {
    id: `${name}-${Date.now()}`,
    name,
    layout: layout as DeviceLayout['layout'],
  };
}

function validateLayoutShape(layout: unknown[]): void {
  if (layout.length < 3 || layout.length > 4) {
    throw new Error(`Expected 3 or 4 layers, found ${layout.length}.`);
  }
  for (const layer of layout) {
    if (
      !Array.isArray(layer) ||
      (layer.length !== 90 && layer.length !== 67) ||
      layer.some((code) => typeof code !== 'number')
    ) {
      throw new Error(
        'Each layer must be an array of 90 (3D) or 67 (Lite/X) numeric action codes.',
      );
    }
  }
}
