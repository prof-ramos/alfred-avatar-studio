import { describe, expect, it } from 'vitest';
import type { LogicalTouchEvent } from '../domain/types';
import { clientToLogical, logicalToClient } from './coords';
import { CircularContactFilter, GestureRecognizer } from './gestures';

const ev = (phase: LogicalTouchEvent['phase'], x: number, y: number, timestamp: number): LogicalTouchEvent => ({ phase, x, y, timestamp, source: 'mouse' });

function gesture(moves: Array<[number, number, number]>, upAt: [number, number, number]) {
  const r = new GestureRecognizer();
  const out = [...r.handle(ev('down', 120, 120, 0))];
  for (const [x, y, t] of moves) out.push(...r.handle(ev('move', x, y, t)));
  out.push(...r.handle(ev('up', ...upAt)));
  return out;
}

describe('reconhecedor de gestos', () => {
  it('toque simples: soltura < 500 ms e deslocamento < 6 px', () => {
    expect(gesture([], [125, 120, 499]).map((g) => g.type)).toEqual(['tap']);
  });

  it('deslocamento de 7 px não gera toque nem swipe', () => {
    expect(gesture([], [127, 120, 100])).toEqual([]);
  });

  it('toque prolongado a partir de 500 ms', () => {
    const r = new GestureRecognizer();
    r.handle(ev('down', 120, 120, 0));
    expect(r.pendingLongPressAt()).toBe(500);
    expect(r.tick(499)).toEqual([]);
    expect(r.tick(500).map((g) => g.type)).toEqual(['longPress']);
    expect(r.handle(ev('up', 120, 120, 800))).toEqual([]);
  });

  it('soltura exatamente aos 500 ms gera toque prolongado, não toque simples', () => {
    expect(gesture([], [120, 120, 500]).map((g) => g.type)).toEqual(['longPress']);
  });

  it.each([
    ['right', 160, 120],
    ['left', 80, 120],
    ['up', 120, 80],
    ['down', 120, 160],
  ] as const)('swipe para %s', (dir, x, y) => {
    const out = gesture([[(120 + x) / 2, (120 + y) / 2, 50]], [x, y, 120]);
    expect(out).toEqual([expect.objectContaining({ type: 'swipe', direction: dir })]);
  });

  it('limiar de swipe: 23 px não, 24 px sim', () => {
    expect(gesture([], [143, 120, 100])).toEqual([]);
    expect(gesture([], [144, 120, 100]).map((g) => g.type)).toEqual(['swipe']);
  });

  it('movimento durante o contato impede o toque prolongado', () => {
    const r = new GestureRecognizer();
    r.handle(ev('down', 120, 120, 0));
    r.handle(ev('move', 130, 120, 100));
    expect(r.pendingLongPressAt()).toBeNull();
  });
});

describe('filtro de contato circular', () => {
  it('ignora contatos iniciados fora do círculo', () => {
    const f = new CircularContactFilter();
    expect(f.filter(ev('down', 5, 5, 0))).toBeNull();
    expect(f.filter(ev('up', 5, 5, 10))).toBeNull();
  });

  it('aceita a borda interna (distância 119) e a fronteira exata (120)', () => {
    expect(new CircularContactFilter().filter(ev('down', 120, 1, 0))).not.toBeNull();
    expect(new CircularContactFilter().filter(ev('down', 120, 0, 0))).not.toBeNull();
    expect(new CircularContactFilter().filter(ev('down', 120, -0.5, 0))).toBeNull();
  });

  it('cancela ao sair do círculo durante o arraste', () => {
    const f = new CircularContactFilter();
    f.filter(ev('down', 120, 120, 0));
    expect(f.filter(ev('move', 200, 120, 10))?.phase).toBe('move');
    expect(f.filter(ev('move', 238, 238, 20))?.phase).toBe('cancel');
    expect(f.filter(ev('move', 120, 120, 30))).toBeNull();
  });
});

describe('conversão de coordenadas', () => {
  it.each([1, 2, 4])('é independente da escala %d×', (s) => {
    const rect = { left: 33, top: 71, width: 240 * s, height: 240 * s };
    for (const [x, y] of [
      [0, 0],
      [120, 120],
      [239, 17],
    ]) {
      const c = logicalToClient(x, y, rect);
      const l = clientToLogical(c.x, c.y, rect);
      expect(Math.floor(l.x)).toBe(x);
      expect(Math.floor(l.y)).toBe(y);
    }
  });
});
