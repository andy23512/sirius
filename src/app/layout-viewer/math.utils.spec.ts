import { cos, sin } from './math.utils';

describe('math.utils', () => {
  it('sin takes degrees', () => {
    expect(sin(0)).toBeCloseTo(0, 12);
    expect(sin(30)).toBeCloseTo(0.5, 12);
    expect(sin(90)).toBeCloseTo(1, 12);
    expect(sin(180)).toBeCloseTo(0, 12);
    expect(sin(270)).toBeCloseTo(-1, 12);
    expect(sin(-90)).toBeCloseTo(-1, 12);
  });

  it('cos takes degrees', () => {
    expect(cos(0)).toBeCloseTo(1, 12);
    expect(cos(60)).toBeCloseTo(0.5, 12);
    expect(cos(90)).toBeCloseTo(0, 12);
    expect(cos(180)).toBeCloseTo(-1, 12);
    expect(cos(270)).toBeCloseTo(0, 12);
  });

  it('are a full turn after 360 degrees', () => {
    expect(sin(405)).toBeCloseTo(sin(45), 12);
    expect(cos(405)).toBeCloseTo(cos(45), 12);
  });
});
