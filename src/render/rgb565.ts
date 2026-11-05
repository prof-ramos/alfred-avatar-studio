// Conversões RGB565 (PRD §3.4, §9.6). A conversão trunca os bits menos significativos,
// como faz a maioria dos drivers ao enviar cores RGB888 para o GC9A01.

export function toRgb565(r: number, g: number, b: number): number {
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}

/** Expande RGB565 de volta para 8 bits por canal, replicando os bits mais significativos. */
export function fromRgb565(v: number): [number, number, number] {
  const r5 = (v >> 11) & 0x1f;
  const g6 = (v >> 5) & 0x3f;
  const b5 = v & 0x1f;
  return [(r5 << 3) | (r5 >> 2), (g6 << 2) | (g6 >> 4), (b5 << 3) | (b5 >> 2)];
}

/** Quantiza um buffer RGBA no próprio lugar, simulando a prévia do display. */
export function quantizeRgb565InPlace(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    const r5 = data[i] >> 3;
    const g6 = data[i + 1] >> 2;
    const b5 = data[i + 2] >> 3;
    data[i] = (r5 << 3) | (r5 >> 2);
    data[i + 1] = (g6 << 2) | (g6 >> 4);
    data[i + 2] = (b5 << 3) | (b5 >> 2);
  }
}

/** Verdadeiro se o valor de 8 bits pode ser produzido pela expansão de um canal de `bits` bits. */
export function isExpandedLevel(value: number, bits: 5 | 6): boolean {
  const q = value >> (8 - bits);
  const expanded = bits === 5 ? (q << 3) | (q >> 2) : (q << 2) | (q >> 4);
  return expanded === value;
}

/**
 * Converte RGBA em bytes RGB565 little-endian (formato do LVGL com LV_COLOR_16_SWAP = 0).
 * Com `swap`, os dois bytes de cada pixel são trocados (LV_COLOR_16_SWAP = 1).
 * Pixels transparentes recebem a cor de fundo informada.
 */
export function rgbaToRgb565Bytes(rgba: Uint8ClampedArray, swap = false, background: [number, number, number] = [0, 0, 0]): Uint8Array {
  const out = new Uint8Array((rgba.length / 4) * 2);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 2) {
    const a = rgba[i + 3] / 255;
    const r = Math.round(rgba[i] * a + background[0] * (1 - a));
    const g = Math.round(rgba[i + 1] * a + background[1] * (1 - a));
    const b = Math.round(rgba[i + 2] * a + background[2] * (1 - a));
    const v = toRgb565(r, g, b);
    const lo = v & 0xff;
    const hi = v >> 8;
    out[j] = swap ? hi : lo;
    out[j + 1] = swap ? lo : hi;
  }
  return out;
}
