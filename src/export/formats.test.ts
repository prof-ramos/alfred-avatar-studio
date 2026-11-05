import { describe, expect, it } from 'vitest';
import { fromRgb565, isExpandedLevel, quantizeRgb565InPlace, rgbaToRgb565Bytes, toRgb565 } from '../render/rgb565';
import {
  ESPHOME_STATES,
  buildSpritesheetMeta,
  computeSheetLayout,
  concatJpegFrames,
  countJpegFrames,
  generateLvglSource,
  toCIdentifier,
} from './formats';
import { frameTimes } from './frames';

describe('RGB565', () => {
  it('converte cores primárias', () => {
    expect(toRgb565(255, 0, 0)).toBe(0xf800);
    expect(toRgb565(0, 255, 0)).toBe(0x07e0);
    expect(toRgb565(0, 0, 255)).toBe(0x001f);
    expect(fromRgb565(0xffff)).toEqual([255, 255, 255]);
  });

  it('quantiza para níveis representáveis', () => {
    const d = new Uint8ClampedArray([125, 201, 63, 255, 7, 3, 250, 128]);
    quantizeRgb565InPlace(d);
    for (let i = 0; i < d.length; i += 4) {
      expect(isExpandedLevel(d[i], 5)).toBe(true);
      expect(isExpandedLevel(d[i + 1], 6)).toBe(true);
      expect(isExpandedLevel(d[i + 2], 5)).toBe(true);
    }
    expect(d[3]).toBe(255);
  });

  it('gera 2 bytes por pixel, little-endian ou trocado', () => {
    const red = new Uint8ClampedArray([255, 0, 0, 255]);
    expect([...rgbaToRgb565Bytes(red)]).toEqual([0x00, 0xf8]);
    expect([...rgbaToRgb565Bytes(red, true)]).toEqual([0xf8, 0x00]);
    expect(rgbaToRgb565Bytes(new Uint8ClampedArray(240 * 240 * 4)).length).toBe(115_200);
  });

  it('compõe pixels transparentes sobre o fundo', () => {
    expect([...rgbaToRgb565Bytes(new Uint8ClampedArray([0, 0, 0, 0]), false, [255, 255, 255])]).toEqual([0xff, 0xff]);
  });
});

describe('pacote ESPHome', () => {
  it('contém exatamente os 7 nomes padronizados', () => {
    expect(ESPHOME_STATES.map((e) => e.file)).toEqual(['idle.png', 'listening.png', 'thinking.png', 'replying.png', 'error.png', 'loading.png', 'mute.png']);
  });
});

describe('spritesheet', () => {
  it('organiza os quadros em matriz quase quadrada', () => {
    const l = computeSheetLayout(10);
    expect([l.columns, l.rows, l.width, l.height]).toEqual([4, 3, 960, 720]);
    expect(l.frames[9]).toEqual({ x: 240, y: 480, w: 240, h: 240 });
  });

  it('metadados somam a duração total', () => {
    const l = computeSheetLayout(7);
    const m = buildSpritesheetMeta(l, { id: 'a', name: 'A', durationMs: 1000, mode: 'loop' }, 7, 'a.png');
    expect(m.frames.reduce((s, f) => s + f.durationMs, 0)).toBe(1000);
    expect(m.animation.loop).toBe(true);
    for (const f of m.frames) {
      expect(f.frame.x + f.frame.w).toBeLessThanOrEqual(m.size.w);
      expect(f.frame.y + f.frame.h).toBeLessThanOrEqual(m.size.h);
    }
  });

  it('amostra a animação na taxa pedida', () => {
    expect(frameTimes(1000, 30)).toHaveLength(30);
    expect(frameTimes(2400, 15)).toHaveLength(36);
    expect(frameTimes(60_000, 30)).toHaveLength(900);
  });
});

describe('MJPEG', () => {
  it('concatena e conta quadros JPEG', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
    const stream = concatJpegFrames([jpeg, jpeg, jpeg]);
    expect(stream.length).toBe(27);
    expect(countJpegFrames(stream)).toBe(3);
  });
});

describe('C Array / LVGL', () => {
  const frame = { name: 'alfred_teste', bytes: new Uint8Array(115_200) };

  it('gera descritor LVGL 9', () => {
    const { c, h } = generateLvglSource('alfred_teste', [frame], 9, false);
    expect(c).toContain('const lv_image_dsc_t alfred_teste');
    expect(c).toContain('LV_COLOR_FORMAT_RGB565');
    expect(c).toContain('.header.stride = 480');
    expect(c).toContain('uint8_t alfred_teste_map[115200]');
    expect(h).toContain('extern const lv_image_dsc_t alfred_teste;');
    expect((c.match(/0x00/g) ?? []).length).toBe(115_200);
  });

  it('gera descritor LVGL 8', () => {
    const { c, h } = generateLvglSource('alfred_teste', [frame], 8, true);
    expect(c).toContain('LV_IMG_CF_TRUE_COLOR');
    expect(c).toContain('LV_COLOR_16_SWAP = 1');
    expect(h).toContain('extern const lv_img_dsc_t alfred_teste;');
  });

  it('normaliza identificadores C', () => {
    expect(toCIdentifier('Alfred Clássico v2!')).toBe('alfred_classico_v2');
    expect(toCIdentifier('2025')).toBe('img_2025');
  });
});
