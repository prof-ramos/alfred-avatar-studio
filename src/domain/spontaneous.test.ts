import { describe, expect, it } from 'vitest';
import { BLINK_DURATION_MS, blinkFactor, blinksBetween, saccadeOffset } from './spontaneous';

describe('comportamento espontâneo', () => {
  it('a mesma semente produz exatamente a mesma agenda', () => {
    const a = blinksBetween(42, 0, 120_000);
    const b = blinksBetween(42, 0, 120_000);
    expect(a.length).toBeGreaterThan(10);
    expect(a).toEqual(b);
  });

  it('sementes diferentes produzem agendas diferentes', () => {
    expect(blinksBetween(42, 0, 60_000)).not.toEqual(blinksBetween(7, 0, 60_000));
  });

  it('a amostragem não depende da ordem de consulta', () => {
    const t = 45_321;
    const late = blinkFactor(1234, t);
    expect(blinkFactor(1234, 10)).toBeGreaterThanOrEqual(0);
    expect(blinkFactor(1234, t)).toBe(late);
    expect(saccadeOffset(99, 30_000)).toEqual(saccadeOffset(99, 30_000));
  });

  it('a piscada fecha e reabre os olhos dentro da duração', () => {
    const [b] = blinksBetween(42, 0, 10_000);
    expect(blinkFactor(42, b - 1)).toBe(1);
    expect(blinkFactor(42, b + BLINK_DURATION_MS / 2)).toBeCloseTo(0, 1);
    expect(blinkFactor(42, b + BLINK_DURATION_MS)).toBe(1);
  });

  it('intervalos entre piscadas ficam entre 2,2 s e 6 s', () => {
    const blinks = blinksBetween(5, 0, 200_000);
    for (let i = 1; i < blinks.length; i++) {
      const gap = blinks[i] - blinks[i - 1];
      expect(gap).toBeGreaterThanOrEqual(2199);
      expect(gap).toBeLessThanOrEqual(6001);
    }
  });
});
