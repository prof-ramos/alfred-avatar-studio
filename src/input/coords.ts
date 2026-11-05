// Normalização de coordenadas de ponteiro para o espaço lógico 0..239 (PRD §5.1).
import { DISPLAY_SIZE } from '../domain/profile';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Converte coordenadas de cliente (CSS px) em coordenadas lógicas do display.
 * Usa apenas o retângulo CSS do canvas, o que torna o resultado independente
 * da escala de visualização e do devicePixelRatio.
 */
export function clientToLogical(clientX: number, clientY: number, rect: Rect): { x: number; y: number } {
  const x = ((clientX - rect.left) / rect.width) * DISPLAY_SIZE;
  const y = ((clientY - rect.top) / rect.height) * DISPLAY_SIZE;
  return { x: Math.floor(x * 100) / 100, y: Math.floor(y * 100) / 100 };
}

/** Converte coordenadas lógicas no centro do pixel correspondente, em CSS px. */
export function logicalToClient(x: number, y: number, rect: Rect): { x: number; y: number } {
  return {
    x: rect.left + ((x + 0.5) / DISPLAY_SIZE) * rect.width,
    y: rect.top + ((y + 0.5) / DISPLAY_SIZE) * rect.height,
  };
}

export function clampLogical(v: number): number {
  return Math.min(DISPLAY_SIZE - 1, Math.max(0, v));
}
