/**
 * Subset the Material Symbols Rounded font down to just the icons Sirius uses,
 * shrinking the bundled ~4.4 MB font to a few KB. Ported from Alnitak's
 * src/tools/minify-icon-font.ts.
 *
 * The icon set is taken from tangent-cc-lib's KeyLabelIcon union type. For each
 * icon we resolve its ligature (e.g. "backspace") to the glyph's PUA codepoint
 * via fontkit, then keep those codepoints plus the ASCII letters/digits/
 * underscore that make up the ligature names (so the `liga` substitution still
 * has its input glyphs at runtime).
 *
 * Run: npm run subset-icon-font
 */
import { subset } from '@web-alchemy/fonttools';
import { openSync } from 'fontkit';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const FONT_IN = 'src/assets/material-symbols-rounded.woff2';
const FONT_OUT = 'src/assets/material-symbols-rounded.min.woff2';

if (!existsSync(FONT_IN)) {
  console.error(
    `Missing subset source font: ${FONT_IN}\n` +
      'It is gitignored (~4.4 MB). Only needed to re-subset; the build uses the\n' +
      'committed .min.woff2. Get "Material Symbols Rounded" (full latin woff2) from\n' +
      '@fontsource-variable/material-symbols-rounded (or the alnitak repo) and place\n' +
      `it at ${FONT_IN}, then re-run this script.`,
  );
  process.exit(1);
}
const ICON_DTS = 'node_modules/tangent-cc-lib/dist/lib/type/key-label-icon.type.d.ts';

// Icons whose ligature glyph has no cmap codepoint; provide the PUA codepoint.
const codePointsOverride = {
  no_sound: 'e710',
};

// Extra icons used in the app's own UI (toolbar / dialog buttons), which aren't
// part of tangent-cc-lib's KeyLabelIcon set.
const UI_ICONS = [
  'settings',
  'push_pin',
  'visibility',
  'visibility_off',
  'open_with',
  'web_asset',
  'remove',
  'close',
  'open_in_new',
  'restart_alt',
];

// Extract the icon names from `export type KeyLabelIcon = 'a' | 'b' | ...;`.
const dts = readFileSync(ICON_DTS, 'utf-8');
const iconSet = new Set([...[...dts.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]), ...UI_ICONS]);
if (iconSet.size === 0) {
  console.error('No icon names found in', ICON_DTS);
  process.exit(1);
}

const font = openSync(FONT_IN);

// Keep the ligature input characters: '_' (5f) .. 'z' (7a) and '0'..'9' (30-39).
const glyphs = ['5f-7a', '30-39'];

for (const icon of iconSet) {
  const iconGlyphs = font.layout(icon).glyphs;
  if (iconGlyphs.length === 0) {
    console.error(`"${icon}" not found in font.`);
    process.exit(1);
  }
  const codePoints = iconGlyphs
    .flatMap((glyph) => font.stringsForGlyph(glyph.id))
    .flatMap((string) => [...string])
    .map((char) => char.codePointAt(0).toString(16));

  if (codePointsOverride[icon]) {
    glyphs.push(codePointsOverride[icon]);
  } else if (codePoints.length === 0) {
    console.error(`No code point found for "${icon}".`);
    process.exit(1);
  }
  glyphs.push(...codePoints);
}

glyphs.sort();

const inputBuffer = readFileSync(FONT_IN);
const outputBuffer = await subset(inputBuffer, {
  unicodes: glyphs.join(','),
  'no-layout-closure': true,
  flavor: 'woff2',
});
writeFileSync(FONT_OUT, outputBuffer);

console.log(
  `Subset ${iconSet.size} icons -> ${FONT_OUT}` +
    ` (${(inputBuffer.length / 1024).toFixed(0)} KB -> ${(outputBuffer.length / 1024).toFixed(1)} KB)`,
);
