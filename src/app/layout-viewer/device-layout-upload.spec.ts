import { parseDeviceLayoutFile } from './device-layout-upload';

const layer = (n = 90, fill: unknown = 0) => new Array(n).fill(fill);
const layers = (count = 3, len = 90): number[][] => Array.from({ length: count }, () => layer(len));
// The result's layout has a fixed-length tuple type; compare as plain lists.
const plain = (value: unknown) => value as number[][];

describe('parseDeviceLayoutFile', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(1700000000000));
  });
  afterEach(() => jasmine.clock().uninstall());

  describe('a bare layout', () => {
    it('is read, named after the file without its extension, with a unique id', () => {
      const result = parseDeviceLayoutFile('my layout.json', JSON.stringify({ layout: layers() }));
      expect(result.name).toBe('my layout');
      expect(result.id).toBe('my layout-1700000000000');
      expect(plain(result.layout)).toEqual(layers());
    });

    it('takes 3 or 4 layers of 90 or 67 codes', () => {
      for (const [count, len] of [
        [3, 90],
        [4, 90],
        [3, 67],
        [4, 67],
      ]) {
        expect(() =>
          parseDeviceLayoutFile('a.json', JSON.stringify({ layout: layers(count, len) })),
        )
          .withContext(`${count} x ${len}`)
          .not.toThrow();
      }
    });

    it('refuses anything else about the number of layers', () => {
      for (const count of [0, 1, 2, 5]) {
        expect(() => parseDeviceLayoutFile('a.json', JSON.stringify({ layout: layers(count) })))
          .withContext(String(count))
          .toThrowError(`Expected 3 or 4 layers, found ${count}.`);
      }
    });

    it('refuses a layer of the wrong length, or not a list, or with non-numbers', () => {
      const message = 'Each layer must be an array of 90 (3D) or 67 (Lite/X) numeric action codes.';
      const bad = [
        [layer(89), layer(), layer()],
        [layer(91), layer(), layer()],
        [layer(), layer(), 'x'],
        [layer(), layer(), { length: 90 }],
        [layer(), layer(), layer(90, '5')],
        [layer(), layer(), [...layer(89), null]],
      ];
      for (const layout of bad) {
        expect(() => parseDeviceLayoutFile('a.json', JSON.stringify({ layout }))).toThrowError(
          message,
        );
      }
    });

    it('refuses a file without a layout list', () => {
      for (const data of [{}, { layout: 'x' }, { layout: {} }, { layout: null }]) {
        expect(() => parseDeviceLayoutFile('a.json', JSON.stringify(data))).toThrowError(
          'No CharaChorder layout found in this file.',
        );
      }
    });

    it('refuses text that is not JSON', () => {
      expect(() => parseDeviceLayoutFile('a.json', 'not json')).toThrowError(
        'File is not valid JSON.',
      );
      expect(() => parseDeviceLayoutFile('a.json', '')).toThrowError('File is not valid JSON.');
    });

    // Current behavior: JSON that is not an object has no layout, and null
    // would be read as a property of nothing.
    it('says there is no layout for JSON that is a number or text', () => {
      expect(() => parseDeviceLayoutFile('a.json', '42')).toThrowError(
        'No CharaChorder layout found in this file.',
      );
      expect(() => parseDeviceLayoutFile('a.json', '"x"')).toThrowError(
        'No CharaChorder layout found in this file.',
      );
    });

    it('fails on a JSON null with a TypeError, not a message', () => {
      expect(() => parseDeviceLayoutFile('a.json', 'null')).toThrowError(TypeError);
    });
  });

  describe('naming', () => {
    const name = (file: string) =>
      parseDeviceLayoutFile(file, JSON.stringify({ layout: layers() })).name;

    it('drops only the last extension', () => {
      expect(name('backup.v2.json')).toBe('backup.v2');
      expect(name('layout.JSON')).toBe('layout');
    });

    it('keeps a name with no extension', () => {
      expect(name('layout')).toBe('layout');
    });

    it('falls back to a default when nothing is left', () => {
      expect(name('.json')).toBe('Uploaded layout');
      expect(name('')).toBe('Uploaded layout');
    });

    it('puts the time in the id, so the same file twice gets two ids', () => {
      const a = parseDeviceLayoutFile('x.json', JSON.stringify({ layout: layers() }));
      jasmine.clock().tick(5);
      const b = parseDeviceLayoutFile('x.json', JSON.stringify({ layout: layers() }));
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('a full backup', () => {
    const backup = (items: unknown[], extra: unknown[][] = []) =>
      JSON.stringify({ history: [items, ...extra] });
    const item = (device: string, layout: unknown = layers(), type = 'layout') => ({
      type,
      device,
      layout,
    });

    it('takes the layout of an accepted device', () => {
      for (const device of ['One', 'ONE', 'TWO', 'M4G']) {
        const result = parseDeviceLayoutFile('b.json', backup([item(device)]));
        expect(plain(result.layout)).toEqual(layers());
      }
    });

    it('takes the first accepted layout, skipping other kinds and other devices', () => {
      const first = layers(3);
      first[0][0] = 7;
      const text = backup([
        { type: 'settings', device: 'ONE' },
        item('LITE', layers(4)),
        item('ONE', first),
        item('TWO', layers(4)),
      ]);
      expect(plain(parseDeviceLayoutFile('b.json', text).layout)).toEqual(first);
    });

    it('does not accept other devices, or other spellings', () => {
      for (const device of ['LITE', 'X', 'one', 'Two', '']) {
        expect(() => parseDeviceLayoutFile('b.json', backup([item(device)])))
          .withContext(device)
          .toThrowError('No CharaChorder layout found in this file.');
      }
    });

    it('only looks at the first history entry', () => {
      expect(() => parseDeviceLayoutFile('b.json', backup([], [[item('ONE')]]))).toThrowError(
        'No CharaChorder layout found in this file.',
      );
    });

    it('refuses when there is no history, or it is not a list', () => {
      for (const history of [[], ['x'], [null], [{}]]) {
        expect(() => parseDeviceLayoutFile('b.json', JSON.stringify({ history }))).toThrowError(
          'No CharaChorder layout found in this file.',
        );
      }
    });

    it('skips a null in the list instead of failing', () => {
      expect(plain(parseDeviceLayoutFile('b.json', backup([null, item('ONE')])).layout)).toEqual(
        layers(),
      );
    });

    it('checks the shape of the layout it found', () => {
      expect(() => parseDeviceLayoutFile('b.json', backup([item('ONE', layers(2))]))).toThrowError(
        'Expected 3 or 4 layers, found 2.',
      );
    });

    it('prefers the history over a layout beside it', () => {
      const other = layers(4);
      const text = JSON.stringify({ layout: other, history: [[item('ONE')]] });
      expect(plain(parseDeviceLayoutFile('b.json', text).layout)).toEqual(layers());
    });

    // Current behavior: `history` that is present but not a list does not
    // stop the bare-layout reading, so a layout beside it is used.
    it('reads a bare layout when history is not a list', () => {
      const text = JSON.stringify({ history: 'x', layout: layers() });
      expect(plain(parseDeviceLayoutFile('b.json', text).layout)).toEqual(layers());
    });
  });
});
