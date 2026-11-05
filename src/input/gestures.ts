// Reconhecedor de gestos de ponto único (PRD §4.6, §5.2).
import { isInsideDisplayCircle } from '../domain/profile';
import type { GestureEvent, GestureThresholds, LogicalTouchEvent, SwipeDirection } from '../domain/types';

export const DEFAULT_THRESHOLDS: GestureThresholds = { longPressMs: 500, movementTolerancePx: 6, swipeMinDistancePx: 24 };

interface Contact {
  startX: number;
  startY: number;
  startT: number;
  maxDist: number;
  longPressFired: boolean;
}

/**
 * Máquina de gestos alimentada por eventos lógicos. O temporizador do toque prolongado
 * é delegado ao chamador por meio de `pendingLongPressAt()` e `tick(now)`, o que mantém
 * a classe pura e testável com relógio simulado.
 */
export class GestureRecognizer {
  private contact: Contact | null = null;

  constructor(private thresholds: GestureThresholds = DEFAULT_THRESHOLDS) {}

  setThresholds(t: GestureThresholds): void {
    this.thresholds = t;
  }

  get active(): boolean {
    return this.contact !== null;
  }

  /** Instante em que o toque prolongado deve disparar, se aplicável. */
  pendingLongPressAt(): number | null {
    if (!this.contact || this.contact.longPressFired) return null;
    if (this.contact.maxDist >= this.thresholds.movementTolerancePx) return null;
    return this.contact.startT + this.thresholds.longPressMs;
  }

  /** Avança o relógio; dispara o toque prolongado quando o limiar é atingido. */
  tick(now: number): GestureEvent[] {
    const at = this.pendingLongPressAt();
    if (at === null || now < at || !this.contact) return [];
    this.contact.longPressFired = true;
    return [{ type: 'longPress', x: this.contact.startX, y: this.contact.startY, timestamp: now }];
  }

  handle(e: LogicalTouchEvent): GestureEvent[] {
    const out: GestureEvent[] = [];
    switch (e.phase) {
      case 'down':
        this.contact = { startX: e.x, startY: e.y, startT: e.timestamp, maxDist: 0, longPressFired: false };
        break;
      case 'move': {
        if (!this.contact) break;
        out.push(...this.tick(e.timestamp));
        const d = Math.hypot(e.x - this.contact.startX, e.y - this.contact.startY);
        this.contact.maxDist = Math.max(this.contact.maxDist, d);
        break;
      }
      case 'up': {
        if (!this.contact) break;
        out.push(...this.tick(e.timestamp));
        const c = this.contact;
        const dx = e.x - c.startX;
        const dy = e.y - c.startY;
        const dist = Math.hypot(dx, dy);
        c.maxDist = Math.max(c.maxDist, dist);
        const duration = e.timestamp - c.startT;
        if (!c.longPressFired) {
          if (dist >= this.thresholds.swipeMinDistancePx) {
            out.push({ type: 'swipe', direction: swipeDirection(dx, dy), dx, dy, timestamp: e.timestamp });
          } else if (c.maxDist < this.thresholds.movementTolerancePx && duration < this.thresholds.longPressMs) {
            out.push({ type: 'tap', x: c.startX, y: c.startY, timestamp: e.timestamp });
          }
        }
        this.contact = null;
        break;
      }
      case 'cancel':
        if (this.contact) out.push({ type: 'cancel', timestamp: e.timestamp });
        this.contact = null;
        break;
    }
    return out;
  }
}

export function swipeDirection(dx: number, dy: number): SwipeDirection {
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
  return dy >= 0 ? 'down' : 'up';
}

/**
 * Regras de contato circular: o contato só começa dentro do círculo e é cancelado
 * assim que o ponteiro sai dele.
 */
export class CircularContactFilter {
  private down = false;

  get isDown(): boolean {
    return this.down;
  }

  filter(e: LogicalTouchEvent): LogicalTouchEvent | null {
    const inside = isInsideDisplayCircle(e.x, e.y);
    switch (e.phase) {
      case 'down':
        if (!inside) return null;
        this.down = true;
        return e;
      case 'move':
        if (!this.down) return null;
        if (!inside) {
          this.down = false;
          return { ...e, phase: 'cancel' };
        }
        return e;
      case 'up':
        if (!this.down) return null;
        this.down = false;
        return inside ? e : { ...e, phase: 'cancel' };
      case 'cancel':
        if (!this.down) return null;
        this.down = false;
        return e;
    }
  }
}
