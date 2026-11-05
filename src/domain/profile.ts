// Perfil de simulação XIAOZHI_ROBOT_BALL_128 (PRD §3.3).

export const DISPLAY_SIZE = 240;
export const DISPLAY_RADIUS = 120;
export const DISPLAY_CENTER = 120;
export const SAFE_AREA_MARGIN = 8;

export const PROFILE = {
  id: 'XIAOZHI_ROBOT_BALL_128',
  board: 'Spotpear Ball V2 (sp-esp32-s3-1.28-box)',
  width: DISPLAY_SIZE,
  height: DISPLAY_SIZE,
  radius: DISPLAY_RADIUS,
  mirrorX: true,
  mirrorY: false,
  colorFormat: 'RGB565',
  safeAreaMargin: SAFE_AREA_MARGIN,
} as const;

/** Verdadeiro quando (x, y) está dentro do círculo visível: (x-120)² + (y-120)² <= 120². */
export function isInsideDisplayCircle(x: number, y: number): boolean {
  const dx = x - DISPLAY_CENTER;
  const dy = y - DISPLAY_CENTER;
  return dx * dx + dy * dy <= DISPLAY_RADIUS * DISPLAY_RADIUS;
}

/** Estimativas de memória gráfica (PRD §11.2), separadas de qualquer medição de runtime. */
export const MEMORY_ESTIMATES = [
  { label: 'Um framebuffer RGB565', formula: '240 × 240 × 2 bytes', bytes: DISPLAY_SIZE * DISPLAY_SIZE * 2 },
  { label: 'Dois framebuffers RGB565 (double buffer)', formula: '240 × 240 × 2 × 2 bytes', bytes: DISPLAY_SIZE * DISPLAY_SIZE * 2 * 2 },
  { label: 'Um raster RGBA (32 bits) no Canvas', formula: '240 × 240 × 4 bytes', bytes: DISPLAY_SIZE * DISPLAY_SIZE * 4 },
] as const;
