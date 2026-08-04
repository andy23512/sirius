import { OperatingSystemName } from 'tangent-cc-lib';
import { UAParser } from 'ua-parser-js';

/**
 * Detect the host OS (Windows / macOS / Linux). Only affects the glyphs shown
 * for meta/alt keys via OS_2_META_KEY_LABEL_MAP / OS_2_ALT_KEY_LABEL_MAP.
 */
export function getOperatingSystem(): OperatingSystemName | undefined {
  return new UAParser().getOS().name as OperatingSystemName | undefined;
}
